# Attention-Aware Event Filtering System — Comprehensive Audit Report

> **Generated:** 2026-02-25  
> **Scope:** `src/` of `task-recurring-notification-management-master`  
> **Purpose:** Gather every detail needed to implement an attention-aware event filtering layer.

---

## Table of Contents

1. [Scheduler — How Due/Overdue Events Are Emitted](#1-scheduler)
2. [SchedulerEvents — Event Type Definitions](#2-schedulerevents)
3. [PluginEventBus — Full Event Map](#3-plugineventbus)
4. [Task Model — Analytics & Attention-Relevant Fields](#4-task-model)
5. [SmartSuggestionEngine — AI Analysis](#5-smartsuggestionengine)
6. [AIOrchestrator — Event Routing Hub](#6-aiorchestrator)
7. [Frontend Reminders & Notification Subscriptions](#7-frontend-reminders)
8. [NotificationAdapter & EventService — Notification Dispatch](#8-notification-dispatch)
9. [UrgencyScoreCalculator — Existing Scoring](#9-urgencyscorecalculator)
10. [Existing Attention/Focus/Suppress/Mute Patterns](#10-existing-attention-patterns)
11. [plugin/events.ts — SiYuan EventBus Wiring](#11-plugin-events)
12. [index.ts — Scheduler Init & Event Binding](#12-index-ts-wiring)
13. [Gap Analysis — What's Missing for Attention-Aware](#13-gap-analysis)

---

## 1. Scheduler

**File:** `src/backend/core/engine/Scheduler.ts` (1007 lines)

### Architecture

```
Scheduler emits "task:due" / "task:overdue" → listeners decide reactions
Scheduler is TIME-FOCUSED ONLY — no side-effects, no notifications
```

### Key State

| Field | Type | Purpose |
|-------|------|---------|
| `emittedDue` | `Set<string>` | Tracks already-emitted "task:due" keys (prevents duplicates) |
| `emittedMissed` | `Set<string>` | Tracks already-emitted "task:overdue" keys |
| `listeners` | `Record<SchedulerEventType, Set<SchedulerEventListener>>` | Two event types: `task:due`, `task:overdue` |
| `isPaused` | `boolean` | CQRS workspace-aware pause state |
| `currentWorkspaceId` | `string \| null` | Filters tasks by workspace |
| `timer` | `SchedulerTimer` | Wraps `setInterval` with configurable interval (default `SCHEDULER_INTERVAL_MS`) |

### Timer Loop: `checkDueTasks()` (private)

1. **Guard:** Returns immediately if `isPaused` or `isChecking` (with 30s timeout recovery).
2. **Task Source:** `this.storage.getTasksDueOnOrBefore(now)` — uses a **due-date index** for O(log n) lookup.
3. **Workspace Filter:** If `currentWorkspaceId` is set, filters out tasks from other workspaces.
4. **Per-Task Processing** (isolated try-catch per task — FIX CRITICAL-001):

```typescript
// DUE emission
if (dueDate <= now) {
  const taskKey = this.buildOccurrenceKey(task.id, dueDate, "hour");
  if (!this.emittedDue.has(taskKey)) {
    this.emitEvent("task:due", { taskId, dueAt, context: "today", task });
    this.registerEmittedKey("due", taskKey);
  }
}

// OVERDUE emission (requires MISSED_GRACE_PERIOD_MS elapsed AND not completed)
if (isDue && now - dueDate >= MISSED_GRACE_PERIOD_MS && (!lastCompletedAt || lastCompletedAt < dueDate)) {
  const taskKey = this.buildOccurrenceKey(task.id, dueDate, "hour");
  if (!this.emittedMissed.has(taskKey)) {
    this.emitEvent("task:overdue", { taskId, dueAt, context: "overdue", task });
    this.registerEmittedKey("missed", taskKey);
  }
}
```

5. **Cleanup:** `cleanupEmittedSets()` prunes entries older than 30 days and caps at 1000 entries.

### Occurrence Key Format

- **Hour precision:** `{taskId}:{ISO-date-truncated-to-13-chars}` → e.g. `task_123:2026-02-25T14`
- **Exact precision:** `{taskId}:{full-ISO-string}` — used only in recovery

### Event Emission: `emitEvent()`

- Iterates all registered listeners for the event type.
- Catches errors per-listener (both sync and async).
- Fire-and-forget for async listeners (`.catch()` logs error).

### Recovery: `recoverMissedTasks()`

- Loads `lastRunAt` from plugin storage.
- For each enabled task with `recurrence.rrule`, calls `recurrenceEngine.getMissedOccurrences(task, lastRunAt, now, { policy: "catchUp", maxMissed: 50 })`.
- Emits `task:overdue` for each missed occurrence (capped at 50 per task).
- Advances tasks to next future occurrence.

### Other Methods

- `markTaskDone(taskId)` → completes task, records analytics, archives, reschedules via RecurrenceEngine.
- `delayTask(taskId, minutes)` → snooze with limit enforcement.
- `skipOccurrence(taskId)` → records miss + reschedule.
- `pause(reason)` / `resume()` → workspace-aware lifecycle.

### Key Finding: NO FILTERING BEFORE EMISSION

The scheduler emits `task:due` for **every** due task unconditionally, as long as the occurrence key hasn't been emitted before. There is:
- **No priority-based filtering**
- **No attention/focus scoring**
- **No rate limiting** (beyond the occurrence key dedup)
- **No batching** (events fire one-at-a-time per task)

---

## 2. SchedulerEvents

**File:** `src/backend/core/engine/SchedulerEvents.ts` (19 lines)

```typescript
export type TaskDueContext = "today" | "overdue";

export interface TaskDueEvent {
  taskId: string;
  dueAt: Date;
  context: TaskDueContext;
  task: Task;
}

export type SchedulerEventType = "task:due" | "task:overdue";
export type SchedulerEventListener = (payload: TaskDueEvent) => void | Promise<void>;
```

### Key Finding

The payload includes the full `Task` object — meaning any downstream filter has access to all task fields (priority, tags, missCount, completionContexts, urgency, etc.) **without** needing to re-fetch.

---

## 3. PluginEventBus — Full Event Map

**File:** `src/backend/core/events/PluginEventBus.ts` (88 lines)

```typescript
export type PluginEventMap = {
  // Task lifecycle
  'task:create':     { source: string; suggestedName?: string; linkedBlockId?: string; linkedBlockContent?: string; suggestedTime?: string | null };
  'task:complete':   { taskId: string; task?: Task };
  'task:skip':       { taskId: string; task?: Task };
  'task:reschedule': { taskId: string; delayMinutes: number; task?: Task };
  'task:snooze':     { taskId: string; minutes: number };
  'task:settings':   { action?: string };
  'task:refresh':    void;
  'task:updated':    { taskId: string };
  'task:saved':      { task: Task; isNew: boolean };
  'task:edit':       { task?: Task };
  'editor:open':     { mode: 'create' | 'edit'; taskId?: string; prefill?: Partial<Task> };

  // Document lifecycle (from SiYuan eventBus)
  'document:opened':  { rootId: string };
  'document:saved':   { rootId: string };
  'document:switched':{ rootId: string };
  'document:closed':  { rootId: string };

  // Dashboard
  'dashboard:filterToday': Record<string, never>;

  // Scheduler / notification
  'task:due':     { taskId?: string };
  'task:overdue': { taskId: string; task?: Task };
  'task:missed':  { taskId: string; task?: Task };

  // Navigation
  'block:navigate': { blockId: string };

  // Block mutation (from SiYuanRuntimeBridge → ReactiveBlockLayer)
  'block:created':  { blockId: string; rootId: string; content?: string };
  'block:updated':  { blockId: string; rootId: string; content?: string };
  'block:deleted':  { blockId: string; rootId: string };
  'block:checkbox': { blockId: string; rootId: string; checked: boolean };

  // Workspace lifecycle (CQRS)
  'workspace:changed': { workspaceId: string };
  'workspace:opened':  { workspaceId: string };
  'workspace:closed':  Record<string, never>;

  // AI Intelligence
  'ai:suggestion':          { taskId: string; suggestions: AISuggestion[] };
  'ai:suggestion:applied':  { taskId: string; suggestionId: string };
  'ai:suggestion:dismissed':{ taskId: string; suggestionId: string };
};
```

### Key Finding: Two Separate Event Systems

1. **Scheduler's own listener system** (`scheduler.on("task:due", ...)`) — wired to `EventService.bindScheduler()`.
2. **PluginEventBus** (`pluginEventBus.on("task:due", ...)`) — wired in `index.ts:onLayoutReady()` for the reminder float.

The `task:due` on PluginEventBus has a **different payload** (`{ taskId?: string }` — no task object!) compared to Scheduler's `TaskDueEvent` which includes the full task. This is a **payload mismatch** — the PluginEventBus `task:due` is emitted from `index.ts` as a simple trigger.

---

## 4. Task Model — Analytics & Attention-Relevant Fields

**File:** `src/backend/core/models/Task.ts` (625 lines)

### Core Fields

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | `string` | Primary key |
| `name` | `string` | Display |
| `dueAt` | `string` (ISO) | When task is due |
| `enabled` | `boolean` | Whether scheduler processes it |
| `priority` | `TaskPriority` | `"lowest" \| "low" \| "normal" \| "medium" \| "high" \| "highest"` |
| `status` | `'todo' \| 'done' \| 'cancelled'` | Semantic status |
| `tags` | `string[]` | Routing & grouping |
| `category` | `string` | Grouping |

### Analytics Fields (Attention-Critical)

| Field | Type | Description |
|-------|------|-------------|
| `completionCount` | `number` | How many times completed |
| `missCount` | `number` | How many times missed |
| `currentStreak` | `number` | Active completion streak |
| `bestStreak` | `number` | All-time best streak |
| `recentCompletions` | `string[]` | Recent completion ISO timestamps (capped) |
| `snoozeCount` | `number` | Snoozes for current occurrence |
| `maxSnoozes` | `number` | Snooze limit |

### AI/ML Analytics Fields

| Field | Type | Description |
|-------|------|-------------|
| `completionTimes` | `number[]` | Unix timestamps of completions |
| `completionDurations` | `number[]` | Minutes to complete |
| `completionContexts` | `Array<{dayOfWeek, hourOfDay, wasOverdue, delayMinutes}>` | Behavioral context (capped at 50) |
| `completionHistory` | `CompletionHistoryEntry[]` | Rich history (gated by `smartRecurrence.enabled`, capped at 100) |
| `suggestionHistory` | `Array<{suggestionId, accepted, timestamp}>` | Suggestion interaction tracking |

### Smart Recurrence Config

| Field | Type | Description |
|-------|------|-------------|
| `smartRecurrence.enabled` | `boolean` | Enable pattern learning |
| `smartRecurrence.autoAdjust` | `boolean` | Auto-adjust schedule |
| `smartRecurrence.minDataPoints` | `number` | Min completions before suggestions |
| `smartRecurrence.confidenceThreshold` | `number` | 0-1 confidence threshold |

### Learning Metrics

| Field | Type | Description |
|-------|------|-------------|
| `learningMetrics.averageDelayMinutes` | `number` | Avg delay from scheduled time |
| `learningMetrics.optimalHour` | `number` | Best hour for this task |
| `learningMetrics.consistencyScore` | `number` | How consistent the user is |
| `learningMetrics.lastLearningUpdate` | `string` | Last ML update timestamp |

### Escalation Policy

```typescript
escalationPolicy?: {
  enabled: boolean;
  levels: Array<{
    missCount: number;
    action: "notify" | "escalate" | "disable";
    channels?: string[];
  }>;
};
```

### Block/Document Binding

| Field | Type | Description |
|-------|------|-------------|
| `blockId` | `string` | Canonical SiYuan block ID |
| `rootId` | `string` | Root document ID |
| `workspaceId` | `string` | Workspace filter |
| `lastMutationTime` | `number` | Last block mutation (epoch ms) |

### Helper Functions

- `recordCompletion(task)` → increments `completionCount`, `currentStreak`, `bestStreak`, appends to `recentCompletions`, populates `completionContexts` (always), populates `completionHistory` (if `smartRecurrence.enabled`).
- `recordMiss(task)` → increments `missCount`, resets `currentStreak`.
- `calculateTaskHealth(task)` → 0-100 score: `(completionRate × 70) + min(30, streak × 3)`.
- `calculateTaskUrgency(task, now)` → delegates to `UrgencyScoreCalculator`.
- `isOverdue(task)`, `isDueToday(task)`, `isBlocked(task, allTasks)`, `isBlocking(task, allTasks)`.

### Key Finding: Rich Data, No Attention Signal

The Task model has **extensive** analytics (`completionContexts`, `missCount`, `currentStreak`, `completionHistory`, `learningMetrics`, `escalationPolicy`), but there are:
- **No attention-related fields** (no `attentionScore`, `lastDismissedAt`, `suppressUntil`, `muteUntil`, `focusWeight`, etc.)
- **No user interaction tracking** beyond completions (no "viewed", "interacted", "dismissed notification" timestamps)
- **No notification fatigue signals** (no `notificationCount`, `lastNotifiedAt`, `notificationsPerDay`)

---

## 5. SmartSuggestionEngine

**File:** `src/backend/core/ai/SmartSuggestionEngine.ts` (264 lines)

### Architecture

- **STATELESS and PURE** — no constructor side-effects, no polling.
- Called **only** by AIOrchestrator in response to events.
- `analyzeTask(task, trigger)` → `AISuggestion[]`

### Trigger Map

| Trigger | Checks Run |
|---------|-----------|
| `task:complete` | abandonment, reschedule, urgency, frequency |
| `task:reschedule` | reschedule, urgency |
| `task:skip` / `task:missed` | abandonment, urgency |
| `task:overdue` | urgency **only** |
| `manual` / unknown | all checks |

### Suggestion Checks

| Check | Condition | Suggestion Type |
|-------|-----------|----------------|
| **Abandonment** | `missCount >= 5 && completionCount === 0` OR `completionRate < 10%` over 10+ events | `"abandon"` (confidence 0.85) — suggest disabling |
| **Reschedule** | `predictBestTime(task).confidence > 0.7` AND current hour differs by 2+ | `"reschedule"` — suggest optimal time |
| **Urgency** | `missCount >= 3` AND priority != high | `"urgency"` (confidence 0.9) — suggest priority bump |
| **Frequency** | `completionRate > 1.5x` scheduled rate | `"frequency"` (confidence 0.75) — suggest increasing |

### `predictBestTime(task)`

- Requires `completionContexts.length >= 3`.
- Counts on-time completions by hour and day-of-week.
- Returns most frequent hour + day with confidence = max_count / total_contexts.

### Key Finding: Good Foundation but No Attention Awareness

The engine detects abandonment candidates and suggests rescheduling, but:
- **No concept of notification fatigue** — doesn't know if user dismissed/ignored the last N notifications.
- **No suppression logic** — can't say "don't show this suggestion, user keeps ignoring it."
- **No cross-task attention budget** — doesn't know if user is already overwhelmed with other tasks.

---

## 6. AIOrchestrator

**File:** `src/backend/core/ai/AIOrchestrator.ts` (140 lines)

### Architecture

- **Event-driven hub** between PluginEventBus → SmartSuggestionEngine → AISuggestionStore → Frontend.
- Created in `onLayoutReady()`, destroyed in `onunload()`.
- **NEVER scans all tasks, NEVER polls** — only reacts to events for specific changed tasks.

### Event Subscriptions

```
task:complete   → analyzeTask(task, 'task:complete')
task:skip       → analyzeTask(task, 'task:skip')
task:reschedule → analyzeTask(task, 'task:reschedule')
task:overdue    → analyzeTask(task, 'task:overdue')
task:missed     → analyzeTask(task, 'task:missed')
```

### Outgoing Events

```
ai:suggestion → { taskId, suggestions[] }
```

### Persistence

- `ai:suggestion:applied` → mark applied in store
- `ai:suggestion:dismissed` → mark dismissed in store

### Key Finding: Clean Insertion Point

The AIOrchestrator is the **ideal place** to add an attention filter layer:
- It already subscribes to all relevant task lifecycle events.
- It already has a `TaskResolver` to fetch the full task object.
- Before calling `this.engine.analyzeTask()`, an attention filter could:
  1. Check if the task should be suppressed.
  2. Check cross-task attention budget.
  3. Rate-limit suggestion emission.

---

## 7. Frontend Reminders & Notification Subscriptions

### ReminderPanel.svelte

**File:** `src/frontend/components/reminders/ReminderPanel.svelte` (378 lines)

- A **dock panel** showing active and upcoming reminders.
- Loads tasks via `taskStorage.loadActive()` — polls every 60 seconds.
- Subscribes to `task:refresh` and `task:saved` events for live updates.
- **Does NOT subscribe to `task:due` or `task:overdue`** — it's poll-based, not event-driven.
- Filters: active tasks with `dueAt <= now` → active reminders; tasks due within 24h → upcoming.

### Reminder Float (floatMounts.ts)

**File:** `src/frontend/mounts/floatMounts.ts` (143 lines)

- A **transient Dialog** that pops up when tasks become due.
- Triggered by `pluginEventBus.on("task:due", ...)` in `index.ts:onLayoutReady()`.
- Loads all active tasks, filters to `dueAt <= now`, renders HTML cards.
- Auto-dismisses after configurable timeout (default 8s, overridden to 10s in index.ts).
- **No filtering** — shows ALL due/overdue tasks up to 10.

### Key Finding: No Filtering Between Event and UI

```
Scheduler.checkDueTasks() 
  → emits TaskDueEvent on Scheduler listener system
    → EventService.handleTaskDue() [webhook + occurrence block]
    → (separately) pluginEventBus.emit("task:due", {}) in index.ts
      → showReminderFloat() → loads ALL due tasks, shows up to 10
```

There is **no attention-aware filtering** anywhere in this chain. Every `task:due` event triggers a full reminder float showing all due tasks.

---

## 8. NotificationAdapter & EventService

### NotificationAdapter

**File:** `src/backend/core/api/NotificationAdapter.ts` (99 lines)

- Wraps SiYuan's `showMessage()` and kernel REST API (`/api/notification/pushMsg`).
- **Dumb pipe** — takes a message + level + timeout, delivers it.
- No filtering, no batching, no attention logic.
- Functions: `notify()`, `notifyInfo()`, `notifyWarn()`, `notifyError()`.

### EventService

**File:** `src/backend/services/EventService.ts` (757 lines)

#### Architecture

- **Orchestrates side effects** from scheduler events.
- Scheduler emits "what happened" → EventService decides "what to do."
- Manages an **outbound webhook queue** to n8n with retry, dedup, HMAC signing.

#### Scheduler Binding

```typescript
bindScheduler(scheduler: Scheduler): void {
  scheduler.on("task:due", (payload) => this.handleTaskDue(payload));
  scheduler.on("task:overdue", (payload) => this.handleTaskOverdue(payload));
}
```

#### `handleTaskDue(event: TaskDueEvent)`

1. Generate task key via `NotificationState.generateTaskKey(taskId, dueAt)`.
2. Check `notificationState.hasNotified(taskKey)` — skip if already notified.
3. If `occurrenceCreator` is set and task has RRULE → create SiYuan occurrence block.
4. Get `escalationLevel` from NotificationState.
5. Call `emitTaskEvent("task.due", task, escalationLevel)` → sends webhook to n8n.
6. Mark notified + save state.

#### `handleTaskOverdue(event: TaskDueEvent)`

1. Similar dedup check via `notificationState.hasMissed(taskKey)`.
2. Send webhook `"task.missed"` with escalation level.
3. Increment escalation + save.

#### Escalation Model

- `NotificationState` tracks per-task escalation levels (0, 1, 2, ...).
- Incremented on each overdue event.
- Reset on completion (`handleTaskCompleted`).
- Webhook payload includes `routing.escalationLevel` and `routing.channels` from task's `notificationChannels`.

#### Key Finding: No Attention Filtering

EventService has:
- **Deduplication** (per occurrence key — won't re-send same due event).
- **Escalation levels** (incremented per overdue, sent to n8n).
- But **no attention-aware filtering**, no rate limiting across tasks, no suppression.

---

## 9. UrgencyScoreCalculator

### UrgencyScoreCalculator.ts

**File:** `src/backend/core/urgency/UrgencyScoreCalculator.ts` (176 lines)

#### Formula

```
score = (priorityScore × 3) + (dueScore × 2) + (scheduledScore × 1.5) + startScore + (overdueScore × 5)
```

#### Components

| Component | Weight | Details |
|-----------|--------|---------|
| **Priority** | ×3 | `5 × priorityMultiplier × 3`. Multipliers: lowest=0.8, low=1.0, normal=1.1, medium=1.2, high=1.5, highest=2.0 |
| **Due Date** | ×2 | `clamp(dueSoonScoreMax - daysUntilDue × dueDateWeight, min, max) × 2`. Max=100, weight=10/day, min=0 |
| **Overdue** | ×5 | `(overdueBaseScore + daysOverdue × overduePenaltyWeight) × 5`. Base=110, penalty=15/day |
| **Scheduled** | ×1.5 | 7.5 if scheduled today/past, `(7-daysUntil) × 1.5` if within 7 days |
| **Start** | ×1 | 5 if can start now, else 0 |

#### Score Range

- Min: 0 (inactive task)
- Max: 1000 (capped by `settings.maxUrgency`)

### UrgencySettings.ts

**File:** `src/backend/core/urgency/UrgencySettings.ts` (55 lines)

Default settings with all configurable multipliers and thresholds.

### UrgencyFilter.ts

**File:** `src/backend/core/query/filters/UrgencyFilter.ts` (64 lines)

Query filter that applies urgency scoring: `above`, `below`, `is` comparators.

### Key Finding: Urgency Exists but Is Not Used for Event Filtering

The urgency calculator is:
- Used by `calculateTaskUrgency()` in the Task model.
- Used by `UrgencyFilter` for query-time filtering.
- **NOT used** by the Scheduler, EventService, or reminder float.
- Considers only time-based factors + priority — **no behavioral signals** (missCount, completionRate, user engagement).

---

## 10. Existing Attention/Focus/Suppress/Mute Patterns

### Search Results

Searched for `attention`, `focus`, `suppress`, `mute`, `abandon` across all `src/` files.

#### Findings

| Pattern | Location | Context |
|---------|----------|---------|
| `abandon` | `SmartSuggestionEngine.ts` | `detectAbandonmentCandidate()` — checks if task should be disabled. Suggestion type `"abandon"`. |
| `focus` | `DependencyGraphView.svelte` | UI prop `focusTaskId` — visual focus in dependency graph. Unrelated to attention scoring. |
| `focus` | `keyboardShortcuts.ts` | Keyboard shortcut contexts like "Task focus", `focusSearch`. Unrelated to notification filtering. |
| `muted` | `UrgencyIndicator.svelte` | CSS `color: var(--text-muted)` — visual styling only. |

### Key Finding: NO Attention-Aware Infrastructure Exists

There are **zero** existing patterns for:
- Attention scoring / attention budget
- Notification suppression / muting
- Focus mode / do-not-disturb
- Notification fatigue detection
- Cross-task priority balancing
- User engagement tracking (viewed/dismissed/interacted timestamps)

---

## 11. plugin/events.ts — SiYuan EventBus Wiring

**File:** `src/plugin/events.ts` (267 lines)

### SiYuan Native Events Registered

| SiYuan Event | Handler | PluginEventBus Emission |
|-------------|---------|------------------------|
| `ws-main` (transactions) | Detects insert/update/delete ops | `task:refresh` |
| `ws-main` (savedoc) | Document saved | `document:saved` |
| `click-blockicon` | Block context menu | Adds "Edit as Task", "Link to Task", "View Task Metadata" menu items |
| `loaded-protyle-static` | Document opened | `document:opened` |
| `loaded-protyle-dynamic` | Embed/backlink loaded | `document:opened` |
| `switch-protyle` | Document switched | `document:switched` |
| `destroy-protyle` | Document closed | `document:closed` |

### Scheduler Event Triggers

```typescript
// These PluginEventBus events trigger immediate scheduler checks (debounced 500ms):
"task:refresh", "task:create", "document:saved", "document:opened"
```

### Key Finding: Document Context Available

The events system tracks which document the user is currently viewing (`document:switched`, `document:opened`, `document:closed`). This is **valuable** for attention-aware filtering — tasks related to the currently open document could be prioritized.

---

## 12. index.ts — Scheduler Init & Event Binding

**File:** `src/index.ts` (883 lines)

### Initialization Order (onload)

1. Register custom icons
2. Detect platform (mobile/desktop)
3. Load settings from storage
4. Initialize core services in dependency order:
   - `PluginEventBus` (singleton)
   - `RecurrenceEngine`
   - `BlockMetadataService`
   - `TaskStorage` → init
   - `Scheduler(taskStorage, undefined, plugin)`
   - `EventService(plugin)` → init → `bindScheduler(scheduler)`
   - `OccurrenceBlockCreator` → wired to EventService
   - `TaskCreationService`, `AutoMigrationService`
   - CQRS: `SiYuanRuntimeBridge`, `ReactiveTaskManager`, `ReactiveBlockLayer`, `CommandRegistry`
5. Enforce RRule migration
6. Initialize stores
7. Register docks, tabs, slash commands
8. Register calendar dock

### Event Wiring (onLayoutReady)

```
registerSiYuanEventHandlers()     → SiYuan native events → PluginEventBus
scheduler.recoverMissedTasks()    → emit task:overdue for missed
scheduler.start()                 → begin timer loop
registerSchedulerEventTriggers()  → task:refresh etc. → scheduler.triggerCheck()

pluginEventBus.on("task:due", () => this.showReminderNotification())
  → showReminderFloat({plugin, services, autoHideMs: 10000})

// Workspace events → scheduler.setWorkspace/resume/pause
pluginEventBus.on("workspace:changed", ...)
pluginEventBus.on("workspace:opened", ...)
pluginEventBus.on("workspace:closed", ...)

// AI layer (starts AFTER scheduler)
new AIOrchestrator(plugin, taskResolver).init()
```

### Key Finding: The Insertion Point

The `task:due` subscription in `onLayoutReady` is the **critical insertion point** for attention-aware filtering:

```typescript
// CURRENT (line ~373):
const unsubDue = this.pluginEventBus.on("task:due", () => {
  this.showReminderNotification();  // ALWAYS shows float
});

// PROPOSED: Insert attention filter here
const unsubDue = this.pluginEventBus.on("task:due", () => {
  if (attentionFilter.shouldShowNotification(taskId)) {
    this.showReminderNotification();
  }
});
```

Similarly, `EventService.handleTaskDue()` could be wrapped with attention-aware logic.

---

## 13. Gap Analysis — What's Missing for Attention-Aware

### Missing Infrastructure

| Gap | Current State | What's Needed |
|-----|--------------|---------------|
| **Attention Score** | No concept exists | A scoring function that considers: urgency, user engagement signals, notification fatigue, time-of-day, document context |
| **User Engagement Tracking** | Only `completionContexts` and `suggestionHistory` exist | Need: `lastViewedAt`, `lastDismissedAt`, `notificationCount`, `interactionHistory` per task |
| **Notification Budget** | No rate limiting across tasks | Need: global "attention budget" per time window (e.g., max 5 notifications per hour) |
| **Suppression/Mute** | No suppression mechanism | Need: `suppressUntil` timestamp, or `muteChannels` per task, or `focusMode` global toggle |
| **Cross-Task Priority Balancing** | Urgency exists but not used in event pipeline | Need: when multiple tasks are due simultaneously, rank by attention score and show only top-N |
| **Document Context Signal** | `document:opened/switched` events exist | Need: boost attention for tasks whose `blockId`/`rootId` matches current document |
| **Notification Fatigue Detection** | `missCount` and `snoozeCount` exist | Need: algorithm that uses snooze frequency, dismiss patterns, and completion delays to detect fatigue |
| **Debounce/Batch Notifications** | Each `task:due` triggers individual float | Need: batch due events within a window and show a single consolidated notification |
| **Abandon Suppression** | `detectAbandonmentCandidate()` exists in SmartSuggestionEngine | Need: automatically suppress notifications for abandonment candidates (currently only suggests disabling) |

### Missing Task Model Fields

```typescript
// Proposed additions to Task interface:
interface AttentionMetadata {
  /** Last time user saw/interacted with this task's notification */
  lastNotifiedAt?: string;
  /** Total notification count for current occurrence */
  notificationCount?: number;
  /** Last time user dismissed a notification for this task */
  lastDismissedAt?: string;
  /** Suppress notifications until this time */
  suppressUntil?: string;
  /** User explicitly muted this task's notifications */
  muted?: boolean;
  /** Computed attention score (cached, recalculated on events) */
  attentionScore?: number;
  /** Last time attention score was computed */
  attentionScoreUpdatedAt?: string;
}
```

### Missing Event Types

```typescript
// Proposed additions to PluginEventMap:
'notification:shown':     { taskId: string; timestamp: string };
'notification:dismissed': { taskId: string; timestamp: string };
'notification:clicked':   { taskId: string; timestamp: string };
'notification:suppressed':{ taskId: string; reason: string };
'attention:budget:exceeded': { windowMs: number; count: number };
```

### Architecture Insertion Points (Ranked by Impact)

1. **EventService.handleTaskDue()** — Add attention gate before webhook dispatch and occurrence block creation.
2. **index.ts onLayoutReady "task:due" subscription** — Add attention gate before `showReminderNotification()`.
3. **Scheduler.checkDueTasks()** — Could add pre-emission filter, but this violates the "scheduler is time-only" principle. Better to keep Scheduler pure and filter downstream.
4. **SmartSuggestionEngine.analyzeTask()** — Already has trigger-based routing. Could add attention-aware suppression of suggestions.
5. **AIOrchestrator.handleTaskEvent()** — Could gate analysis based on attention budget.
6. **ReminderPanel.svelte** — Could sort/filter displayed reminders by attention score.
7. **floatMounts.ts loadDueReminders()** — Could rank and limit displayed tasks by attention score.

### Recommended Architecture

```
                    ┌─────────────────┐
                    │    Scheduler     │  (pure time-focused, no change)
                    │  checkDueTasks() │
                    └────────┬────────┘
                             │ emits task:due / task:overdue
                             ▼
                ┌────────────────────────┐
                │   AttentionGateFilter  │  ← NEW
                │  ─────────────────────  │
                │  • attentionScore(task) │
                │  • budgetCheck(window)  │
                │  • suppressCheck(task)  │
                │  • documentContext()    │
                └─────────┬──────────────┘
                          │ filtered events only
              ┌───────────┴──────────────┐
              ▼                          ▼
    ┌──────────────┐          ┌───────────────────┐
    │ EventService │          │ PluginEventBus    │
    │ (webhook)    │          │ → reminder float  │
    └──────────────┘          │ → AI orchestrator │
                              └───────────────────┘
```

---

## Appendix: Key Constants

From `src/shared/constants/misc-constants.ts` (referenced but not read):

| Constant | Usage |
|----------|-------|
| `SCHEDULER_INTERVAL_MS` | Timer tick interval |
| `MISSED_GRACE_PERIOD_MS` | Time after due before marking as missed |
| `DEFAULT_MAX_SNOOZES` | Default snooze limit |
| `EMITTED_OCCURRENCES_KEY` | Storage key for emitted state persistence |
| `LAST_RUN_TIMESTAMP_KEY` | Storage key for recovery timestamp |
| `MAX_RECOVERY_ITERATIONS` | Cap on recovery loop |
| `MAX_RECENT_COMPLETIONS` | Cap on `recentCompletions` array |
| `CURRENT_SCHEMA_VERSION` | Task schema version |

---

*End of audit report.*
