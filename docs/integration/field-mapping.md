# Field Mapping Reference

## Overview

This document provides a comprehensive mapping between the UI model (TaskDraft), the business model (Task), and the 1-Tasks format.

## Complete Field Mapping Table

| UI Field (TaskDraft) | Business Model (Task) | 1-Tasks | Type | Adapter Logic | Notes |
|----------------------|----------------------|----------------|------|---------------|-------|
| `id` | `id` | - | string | Direct copy | UUID, undefined for new tasks |
| `name` | `name` | description | string | Direct copy | Required field |
| `description` | `description` | - | string? | Direct copy | Optional notes |
| `priority` | `priority` | priority | Priority | normalizePriority() | See Priority Mapping |
| `status` | `status` | status.symbol | Status | Direct copy | 'todo' \| 'done' \| 'cancelled' |
| `dueAt` | `dueAt` | due | ISO string | Direct copy | Required, validated |
| `scheduledAt` | `scheduledAt` | scheduled | ISO string? | Direct copy | Optional |
| `startAt` | `startAt` | start | ISO string? | Direct copy | Optional |
| `recurrenceText` | `recurrenceText` | recurrence | string | Direct copy | Human-readable |
| - | `frequency` | - | Frequency | RecurrenceParser.parse() | Parsed from recurrenceText |
| `whenDone` | `whenDone` | - | boolean? | Direct copy | Recur from completion |
| `blockedBy` | `blockedBy` | - | string[]? | Direct copy | Task IDs blocking this |
| `dependsOn` | `dependsOn` | dependsOn | string[]? | Direct copy | Task IDs this depends on |
| `tags` | `tags` | tags | string[]? | Direct copy | Categorization |
| - | `enabled` | - | boolean | Always true | Legacy field |
| - | `createdAt` | created | ISO string | new Date().toISOString() | Timestamp |
| - | `updatedAt` | - | ISO string | new Date().toISOString() | Timestamp |
| - | `version` | - | number | CURRENT_SCHEMA_VERSION (5) | Migration support |
| - | `completionCount` | - | number | Default 0 | Analytics |
| - | `missCount` | - | number | Default 0 | Analytics |
| - | `currentStreak` | - | number | Default 0 | Analytics |
| - | `bestStreak` | - | number | Default 0 | Analytics |
| - | `recentCompletions` | - | string[] | Default [] | Analytics |
| - | `lastCompletedAt` | done | ISO string? | Set on completion | Completion timestamp |
| - | `doneAt` | done | ISO string? | Set when status = 'done' | 1-Tasks compat |
| - | `cancelledAt` | - | ISO string? | Set when status = 'cancelled' | Cancellation timestamp |
| - | `statusSymbol` | status.symbol | string? | StatusAdapter.statusToSymbol() | Checkbox character |

## Priority Mapping

### String to Business Model

| UI Priority | Business Model Value | Number Equivalent | Notes |
|-------------|---------------------|-------------------|-------|
| `"lowest"` | `"lowest"` | 0 | Minimal urgency |
| `"low"` | `"low"` | 1 | Below normal |
| `"normal"` | `"normal"` | 2 | Default |
| `"medium"` | `"medium"` | 3 | Above normal |
| `"high"` | `"high"` | 4 | Important |
| `"highest"` | `"highest"` | 5 | Critical |

### 1-Tasks Priority Symbols

| Symbol | Priority | Business Model |
|--------|----------|----------------|
| `⏬` | Lowest | `"lowest"` |
| `🔽` | Low | `"low"` |
| - | Normal | `"normal"` |
| `🔼` | Medium | `"medium"` |
| `⏫` | High | `"high"` |
| `🔺` | Highest | `"highest"` |

## Status Mapping

### Status Types

| UI Status | Business Model | 1 Symbol | Checkbox | Description |
|-----------|---------------|-----------------|----------|-------------|
| `"todo"` | `"todo"` | ` ` (space) | `- [ ]` | Pending task |
| `"done"` | `"done"` | `x` or `X` | `- [x]` | Completed |
| `"cancelled"` | `"cancelled"` | `-` or `/` | `- [-]` | Cancelled |

### Status Transitions

```
todo → done (mark complete)
    ├─ Set lastCompletedAt
    ├─ Set doneAt
    ├─ Increment completionCount
    ├─ Update streak
    └─ Schedule next occurrence

todo → cancelled (cancel task)
    ├─ Set cancelledAt
    └─ Exclude from active queries

done → todo (reactivate)
    ├─ Clear doneAt
    └─ Clear lastCompletedAt

cancelled → todo (reactivate)
    └─ Clear cancelledAt
```

## Date Fields

### ISO 8601 Format

All dates stored as ISO 8601 strings in UTC:
```
"2026-02-03T10:00:00.000Z"
```

### Date Field Constraints

```typescript
startAt <= scheduledAt <= dueAt
```

| Field | Required | Validation |
|-------|----------|------------|
| `dueAt` | ✅ Yes | Must be valid ISO date |
| `scheduledAt` | ❌ No | If provided, must be valid and <= dueAt |
| `startAt` | ❌ No | If provided, must be valid and <= dueAt |
| `createdAt` | ✅ Yes | Auto-generated |
| `updatedAt` | ✅ Yes | Auto-updated |
| `lastCompletedAt` | ❌ No | Set on completion |
| `doneAt` | ❌ No | Set when status = 'done' |
| `cancelledAt` | ❌ No | Set when status = 'cancelled' |

### UI Date Input Format

TaskEditorModal uses `datetime-local` input:
```
"2026-02-03T10:00"  // No timezone, no seconds
```

Converted to ISO for storage:
```typescript
new Date(dateTimeLocal).toISOString()
// → "2026-02-03T10:00:00.000Z"
```

## Recurrence Fields

### Recurrence Text Format

Human-readable natural language:
```
"every day"
"every week on monday"
"every 2 weeks"
"every month on the 15th"
"every year on january 1st"
"when done"
```

### Frequency Object Structure

```typescript
interface Frequency {
  type: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  weekdays?: number[];      // Monday=0, Tuesday=1, ..., Sunday=6 (non-standard indexing)
  dayOfMonth?: number;      // 1-31
  month?: number;           // 1-12
  time?: string;            // "HH:MM"
  timezone?: string;        // IANA timezone
  whenDone?: boolean;       // Recur from completion
  rruleString?: string;     // RFC 5545 RRULE
  dtstart?: string;         // ISO start date
}
```

**Note:** Weekday indexing uses Monday=0 (non-standard). This differs from JavaScript's Date.getDay() which uses Sunday=0.

### RRULE Mapping

| Frequency Type | RRULE Example |
|----------------|---------------|
| Daily | `FREQ=DAILY;INTERVAL=1` |
| Weekly | `FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR` |
| Monthly | `FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=15` |
| Yearly | `FREQ=YEARLY;INTERVAL=1;BYMONTH=1;BYMONTHDAY=1` |

## Dependency Fields

### Dependency Arrays

```typescript
dependsOn: string[]    // Tasks this task depends on
blockedBy: string[]    // Tasks blocking this task
blocks: string[]       // Tasks this task blocks (derived, not stored)
```

### Dependency Validation

- Task cannot depend on itself
- Task cannot be in both `dependsOn` and `blockedBy` of the same task
- Circular dependencies detected via DependencyIndex + CycleDetector
- Validation mode configurable: "warn" or "block"

## Analytics Fields

### Completion Tracking

```typescript
completionCount: number           // Total completions
missCount: number                 // Total misses
currentStreak: number             // Current streak
bestStreak: number                // Best streak ever
recentCompletions: string[]       // Last 10 completion timestamps
```

### Pattern Learning Fields

```typescript
completionHistory: CompletionHistoryEntry[] = [{
  scheduledFor: "2026-01-28T10:00:00.000Z",
  completedAt: "2026-01-28T10:15:00.000Z",
  delayMinutes: 15,
  dayOfWeek: 2,  // Tuesday
  context: {
    location: "office",
    tags: ["work"],
    relatedBlocks: ["block_id_1"]
  }
}]

learningMetrics = {
  averageDelayMinutes: 12.5,
  optimalHour: 10,
  consistencyScore: 0.85,
  lastLearningUpdate: "2026-01-28T05:45:17.383Z"
}
```

## Block-Linked Fields

### Block Integration

```typescript
linkedBlockId?: string             // SiYuan block ID
linkedBlockContent?: string        // Cached block content
blockActions?: BlockLinkedAction[] // Smart actions
```

### Block Actions

```typescript
interface BlockLinkedAction {
  id: string;
  type: "complete" | "snooze" | "delegate" | "custom";
  trigger: "onCreate" | "onComplete" | "onMiss" | "manual";
  condition?: string;              // Expression
  action: {
    type: string;
    params: Record<string, any>;
  };
  enabled: boolean;
}
```

## Adapter Functions

### TaskDraftAdapter.taskToTaskDraft()

Converts full Task to UI-friendly TaskDraft:
```typescript
taskToTaskDraft(task: Task): TaskDraft {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    priority: normalizePriorityToUI(task.priority),
    status: task.status || "todo",
    dueAt: task.dueAt,
    scheduledAt: task.scheduledAt,
    startAt: task.startAt,
    recurrenceText: task.recurrenceText || stringify(task.frequency),
    whenDone: task.whenDone,
    blockedBy: task.blockedBy,
    dependsOn: task.dependsOn,
    tags: task.tags
  };
}
```

### TaskDraftAdapter.taskDraftToTask()

Converts TaskDraft to partial Task for saving:
```typescript
taskDraftToTask(draft: TaskDraft): Partial<Task> {
  const frequency = RecurrenceParser.parse(draft.recurrenceText);
  
  return {
    id: draft.id,
    name: draft.name,
    description: draft.description,
    priority: normalizePriorityFromUI(draft.priority),
    status: draft.status,
    dueAt: draft.dueAt,
    scheduledAt: draft.scheduledAt,
    startAt: draft.startAt,
    recurrenceText: draft.recurrenceText,
    frequency: frequency || undefined,
    whenDone: draft.whenDone,
    blockedBy: draft.blockedBy,
    dependsOn: draft.dependsOn,
    tags: draft.tags,
    updatedAt: new Date().toISOString()
  };
}
```

### StatusAdapter Functions

```typescript
// Symbol to status
symbolToStatus(" ") → "todo"
symbolToStatus("x") → "done"
symbolToStatus("-") → "cancelled"

// Status to symbol
statusToSymbol("todo") → " "
statusToSymbol("done") → "x"
statusToSymbol("cancelled") → "-"

// Helpers
isDoneSymbol("x") → true
isCancelledSymbol("-") → true
isTodoSymbol(" ") → true
```

## Default Values

When creating a new task:

```typescript
{
  id: generateUUID(),
  enabled: true,
  status: "todo",
  priority: "normal",
  recurrenceText: "every day",
  frequency: { type: "daily", interval: 1 },
  whenDone: false,
  completionCount: 0,
  missCount: 0,
  currentStreak: 0,
  bestStreak: 0,
  recentCompletions: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 5
}
```

## Migration Notes

### Schema Version 5

Current schema includes:
- RRULE-based recurrence
- 1-Tasks field compatibility
- Block-linked actions
- Pattern learning fields
- Enhanced analytics

### Legacy Field Support

Fields preserved for backward compatibility:
- `enabled` (boolean) - Always true for active tasks
- Legacy recurrence snapshot (for rollback)

## Summary

This mapping ensures:
1. **Type Safety**: Clear types at each layer
2. **Data Integrity**: Validation at boundaries
3. **Compatibility**: 1-Tasks format support
4. **Lossless Conversion**: No data lost in transformations
5. **Clear Ownership**: Each field's source of truth is documented
