# Backend Architecture

This directory contains the core business logic and data management for the
Shehab-Note recurring task plugin. The system follows a **block-reactive CQRS**
pattern: SiYuan kernel events flow through a runtime bridge into a reactive task
manager, which drives the scheduler, notification state, and block attribute
updates.

## Event Flow (CQRS)

```
Checkbox Toggle / Block Edit
       ↓
SiYuanRuntimeBridge          ← ws-main transaction listener
       ↓
ReactiveTaskManager           ← block-mutation-driven lifecycle
       ↓
OnCompletion / Scheduler      ← recurrence engine + notification
       ↓
NotificationState             ← dedup + escalation
       ↓
updateBlockAttrs()            ← write back to SiYuan kernel
       ↓
Task.store updated            ← frontend reactivity
```

## Directory Structure

```
backend/
├── runtime/                      # ★ SiYuan Kernel Bridge (CQRS)
│   ├── SiYuanRuntimeBridge.ts    # Reactive bridge: ws-main → block mutations
│   └── index.ts                  # Barrel exports
├── blocks/                       # Block-related operations
│   ├── blocks.ts                 # Block fetching and preview utilities
│   ├── ReactiveBlockLayer.ts     # ★ Event-driven block monitoring
│   └── index.ts                  # Barrel exports
├── commands/                     # Command handlers and registry
│   ├── CommandRegistry.ts        # ★ SiYuan-native command dispatcher
│   └── types/                    # Command type definitions
│       └── BulkCommandTypes.ts   # Bulk command types
├── core/                         # Core domain logic
│   ├── actions/                  # Task action handlers (complete, delete, etc.)
│   ├── ai/                       # AI-driven features (suggestions, scoring)
│   ├── analytics/                # Task analytics and calculations
│   ├── api/                      # Domain API layer
│   │   ├── block-api.ts          # Block API utilities
│   │   ├── BlockMetadataService.ts # Block metadata CRUD
│   │   └── SiYuanApiAdapter.ts   # Legacy SiYuan API wrapper
│   ├── block-actions/            # Block event triggers and actions
│   │   ├── BlockActionEngine.ts  # Block action evaluation engine
│   │   ├── BlockActionEvaluator.ts # Condition evaluator
│   │   ├── BlockActionExplainer.ts # Human-readable action descriptions
│   │   ├── BlockActionTypes.ts   # Action type definitions
│   │   └── BlockEventWatcher.ts  # DOM-based event watcher (legacy)
│   ├── engine/                   # Scheduling and recurrence engine
│   │   ├── recurrence/           # Recurrence calculation (RRULE)
│   │   ├── NotificationState.ts  # Notification tracking & dedup
│   │   ├── OccurrenceBlockCreator.ts # Creates blocks for occurrences
│   │   ├── OnCompletion.ts       # Completion handlers (keep/delete/archive)
│   │   ├── Scheduler.ts          # ★ Workspace-aware scheduling engine
│   │   ├── SchedulerEvents.ts    # Scheduler event types
│   │   ├── SchedulerTimer.ts     # Self-correcting timer loop
│   │   └── TimezoneHandler.ts    # Timezone normalization
│   ├── dependencies/             # Task dependency management
│   ├── escalation/               # Task escalation logic
│   ├── events/                   # Internal event system
│   │   └── PluginEventBus.ts     # ★ Typed event bus (block + workspace events)
│   ├── managers/                 # Lifecycle managers
│   │   └── ReactiveTaskManager.ts # ★ Block-mutation-driven task lifecycle
│   ├── models/                   # Domain models
│   │   ├── Task.ts               # ★ Task entity (block-aware: blockId, rootId, workspaceId)
│   │   ├── Frequency.ts          # Recurrence frequency types
│   │   └── RecurrencePatterns.ts # Recurrence pattern definitions
│   ├── parsers/                  # Text parsing (dates, recurrence)
│   │   ├── DateParser.ts         # Natural language date parsing
│   │   ├── RecurrenceParser.ts   # RRULE recurrence parsing
│   │   ├── TaskLineParser.ts     # Task line parsing
│   │   └── TaskLineSerializer.ts # Task line serialization
│   ├── query/                    # Query engine and filters
│   ├── settings/                 # Settings management
│   ├── storage/                  # Data persistence layer
│   │   ├── migrations/           # Schema migrations
│   │   ├── ActiveTaskStore.ts    # Active tasks storage
│   │   ├── ArchiveTaskStore.ts   # Archived tasks storage
│   │   ├── MigrationManager.ts   # Migration orchestration
│   │   ├── TaskIndex.ts          # Task indexing
│   │   └── TaskStorage.ts        # Main storage facade
│   └── ui/                       # UI state management
├── events/                       # Event system
│   ├── EventQueue.ts             # Persistent event queue (fetchSyncPost)
│   ├── EventSubscriptionManager.ts # Webhook subscriptions
│   └── types/                    # Event type definitions
├── features/                     # Feature implementations
│   └── AutoTaskCreator.ts        # Automatic task creation
├── logging/                      # Logging infrastructure
│   └── logger.ts                 # Main logger (canonical)
├── services/                     # Application services
│   ├── EventService.ts           # Event orchestration service
│   ├── event-service.types.ts    # Service type definitions
│   └── ...                       # Additional services
└── webhooks/                     # Webhook infrastructure
    ├── inbound/                  # Incoming webhooks
    ├── outbound/                 # Outgoing webhooks
    └── types/                    # Webhook type definitions
```

> Files marked with ★ were created or significantly modified in the CQRS refactoring phase.

## Key Modules

### SiYuanRuntimeBridge (`runtime/SiYuanRuntimeBridge.ts`)

The central event bridge between SiYuan's kernel and the task engine.
Replaces REST-style polling with real-time ws-main transaction listening.

```typescript
import { SiYuanRuntimeBridge } from '@backend/runtime';

// Lifecycle
bridge.start();   // Call in onLayoutReady()
bridge.stop();    // Call in onunload()

// Subscriptions
bridge.subscribeBlockUpdate((mutation) => { ... });
bridge.subscribeBlockDelete((mutation) => { ... });
bridge.subscribeCheckboxToggle((event) => { ... });
bridge.subscribeRuntimeEvent((event) => { ... });

// Block API (all via fetchSyncPost)
await bridge.getBlockTree(blockId);
await bridge.updateBlockAttrs(blockId, attrs);
await bridge.getBlockAttrs(blockId);
await bridge.getBlockInfo(blockId);
await bridge.querySql(sql);
```

### ReactiveTaskManager (`core/managers/ReactiveTaskManager.ts`)

Block-mutation-driven task lifecycle manager. Subscribes to the runtime
bridge and reacts to block create/update/delete/checkbox events.

```typescript
import { ReactiveTaskManager } from '@backend/core/managers/ReactiveTaskManager';

const manager = new ReactiveTaskManager({
  storage, scheduler, pluginEventBus, runtimeBridge, blockMetadataService
});

manager.wire();    // Subscribe to block mutations (onLayoutReady)
manager.destroy(); // Unsubscribe all (onunload)
```

### CommandRegistry (`commands/CommandRegistry.ts`)

SiYuan-native command dispatcher. Registers commands via `plugin.addCommand()`.

| Command              | Hotkey  | Mount Point      |
|---------------------|---------|------------------|
| Create Recurring Task | ⌘⌥T    | Command Palette  |
| Open Task Editor      | ⌘⇧N    | Command Palette  |
| Skip Recurrence       | ⌘⌥S    | Command Palette  |
| Today's Tasks         | ⌘⌥D    | Command Palette  |
| Open Task Tab         | ⌘⇧T    | Command Palette  |
| Checkbox Toggle       | —      | Runtime Bridge   |
| Quick Actions         | ⌘⌥P    | Command Palette  |

### Workspace-Aware Scheduler (`core/engine/Scheduler.ts`)

The scheduler now supports pause/resume and workspace filtering:

```typescript
scheduler.pause("workspace closed");
scheduler.resume();
scheduler.setWorkspace(workspaceId);
scheduler.getIsPaused();
```

Tasks are filtered by `currentWorkspaceId` in `checkDueTasks()` — tasks
without a `workspaceId` pass through for backward compatibility.

### Block-Aware Task Model (`core/models/Task.ts`)

Extended with CQRS metadata:

```typescript
interface Task {
  // ... existing fields ...
  blockId?: string;          // Canonical SiYuan block ID
  rootId?: string;           // Root document ID
  workspaceId?: string;      // Workspace identifier
  lastMutationTime?: number; // Epoch ms of last block mutation
}
```

### PluginEventBus (`core/events/PluginEventBus.ts`)

Typed event bus with block and workspace lifecycle events:

```typescript
// Task events
pluginEventBus.on('task:due', handler);
pluginEventBus.on('task:complete', handler);
pluginEventBus.on('task:skip', handler);
pluginEventBus.on('task:reschedule', handler);
pluginEventBus.on('task:refresh', handler);

// Block events
pluginEventBus.on('block:created', handler);
pluginEventBus.on('block:updated', handler);
pluginEventBus.on('block:deleted', handler);
pluginEventBus.on('block:checkbox', handler);

// Workspace lifecycle
pluginEventBus.on('workspace:changed', handler);
pluginEventBus.on('workspace:opened', handler);
pluginEventBus.on('workspace:closed', handler);
```

## Plugin Lifecycle Integration

All backend services are wired into the SiYuan plugin lifecycle in `src/index.ts`:

```
onload()
  ├── Initialize core services (storage, scheduler, eventService)
  ├── Initialize CQRS services (runtimeBridge, reactiveTaskManager, reactiveBlockLayer, commandRegistry)
  ├── Register docks (Dashboard, Reminder, Calendar)
  ├── Register commands, slash, tabs
  └── Build service container for UI

onLayoutReady()
  ├── Register top bar button
  ├── Bind SiYuan event handlers
  ├── Start scheduler + recover missed tasks
  ├── Start runtimeBridge
  ├── Wire reactiveTaskManager
  ├── Start reactiveBlockLayer
  ├── Register commandRegistry commands
  └── Wire workspace events → scheduler.pause/resume/setWorkspace

onunload()
  ├── Destroy commandRegistry
  ├── Stop reactiveBlockLayer
  ├── Destroy reactiveTaskManager
  ├── Stop runtimeBridge
  ├── Stop scheduler
  ├── Unmount all Svelte UI
  ├── Flush storage
  ├── Shutdown event service
  ├── Unregister event handlers
  └── Clear pluginEventBus
```

## Import Paths

Use absolute imports with path aliases:

```typescript
// ✅ Correct
import { SiYuanRuntimeBridge } from '@backend/runtime';
import { ReactiveTaskManager } from '@backend/core/managers/ReactiveTaskManager';
import { CommandRegistry } from '@backend/commands/CommandRegistry';
import { Task } from '@backend/core/models/Task';
import { Scheduler } from '@backend/core/engine/Scheduler';
import * as logger from '@backend/logging/logger';

// ❌ Avoid relative imports
import { Task } from '../../../core/models/Task';
```

## Architecture Patterns

### Block-Reactive CQRS
Block mutations flow through a single bridge into domain handlers:

```
SiYuanRuntimeBridge → ReactiveTaskManager → Scheduler → NotificationState → updateBlockAttrs
```

### Repository Pattern
Data access is abstracted through repositories:

```
TaskStorage → ActiveTaskStore / ArchiveTaskStore
```

### Event-Driven
The scheduler emits semantic events that services react to:

```
Scheduler → emit('task:due') → EventService → OutboundWebhookEmitter
```

### Dependency Injection
Services are injected via constructor parameters:

```typescript
new ReactiveTaskManager({ storage, scheduler, pluginEventBus, runtimeBridge, blockMetadataService })
```

### Layer Separation
- **Backend** — Business logic, data access, kernel bridge, external integrations
- **Frontend** — UI components, Svelte mount controllers, user interactions
- **Plugin** — SiYuan lifecycle wiring (commands, docks, tabs, topbar, events, slash)
- **Shared** — Common utilities, types, constants

**Never import frontend code in backend.**

## Testing
- Unit tests: Co-located with source files (`*.test.ts`, `__tests__/`)
- Integration tests: `tests/integration/`
- Security tests: `tests/security/`

## Related Documentation
- [Architecture Diagram](../docs/integration/architecture-diagram.md)
- [Data Flow](../docs/integration/data-flow.md)
- [AI Features](../docs/AI_FEATURES.md)




task-recurring-notification-management-master/
│
├── .github/
│   └── copilot-instructions.md
│
├── scripts/
│   └── make_dev_link.js                        # Symlink dist/ → SiYuan workspace
│
├── src/
│   ├── index.ts                                # Plugin entry: onload(), addDock(), init TaskManager
│   │
│   ├── core/
│   │   ├── managers/
│   │   │   └── TaskManager.ts                  # Central singleton: Settings → Storage → Events → Scheduler → PatternLearner
│   │   │
│   │   ├── engine/
│   │   │   └── Scheduler.ts                    # Emits task:due, task:overdue; TimezoneHandler integration
│   │   │
│   │   ├── models/
│   │   │   └── Task.ts                         # Task schema: enabled, version, blockActions[], dependsOn[], analytics
│   │   │
│   │   ├── storage/
│   │   │   └── TaskStorage.ts                  # In-memory Map + SiYuan persistence; triple indexing; chunked archive loading
│   │   │
│   │   └── ai/
│   │       └── SmartSuggestionEngine.ts        # Rule-based: abandonment, reschedule, urgency, frequency optimization
│   │
│   ├── services/
│   │   └── EventService.ts                     # NotificationState owner; reacts to Scheduler events
│   │
│   ├── recurrence/
│   │   ├── RecurrenceCalculator.ts             # Forward progress validation; MAX_RECOVERY_ITERATIONS=1000; horizon check
│   │   └── RecurrenceEngineRRULE.ts            # rrule library wrapper; OnCompletionHandler for next occurrence
│   │
│   ├── parser/
│   │   └── InlineTaskParser.ts                 # Emoji metadata (📅🔁🔺🔼🔽🆔⛔#); chrono-node NLP; markdown ↔ ParsedTask
│   │
│   ├── commands/
│   │   └── InlineToggleHandler.ts              # Checkbox toggle with 100ms debounce; DOM state sync
│   │
│   ├── events/
│   │   ├── OutboundWebhookEmitter.ts           # Fire-and-forget; n8n, Telegram, Gmail channels
│   │   ├── EventQueue.ts                       # Async delivery queue
│   │   ├── RetryManager.ts                     # Failed webhook retry logic
│   │   └── SignatureGenerator.ts               # HMAC signature for webhook security
│   │
│   ├── filters/
│   │   └── GlobalFilter.ts                     # Singleton; applied at storage load; exclude matching patterns
│   │
│   ├── timezone/
│   │   └── TimezoneHandler.ts                  # Date normalization; respects task.timezone field
│   │
│   ├── constants/
│   │   └── blockAttributes.ts                  # BLOCK_ATTR_TASK_ID, BLOCK_ATTR_TASK_DUE, etc.
│   │
│   └── __tests__/
│       └── siyuan-stub.ts                      # SiYuan API mock for unit tests
│
├── tests/
│   ├── core/
│   │   ├── TaskManager.test.ts                 # Singleton init order, service coordination
│   │   ├── Scheduler.test.ts                   # Event emission, timezone edge cases
│   │   └── SmartSuggestionEngine.test.ts       # Abandonment, reschedule, urgency thresholds
│   │
│   ├── recurrence/
│   │   └── RecurrenceCalculator.test.ts        # Forward progress, RECURRENCE_NO_PROGRESS, interval=0
│   │
│   ├── parser/
│   │   └── InlineTaskParser.test.ts            # Emoji parsing, NLP dates, bidirectional conversion
│   │
│   ├── events/
│   │   └── OutboundWebhookEmitter.test.ts      # Retry, signature, multi-channel delivery
│   │
│   └── storage/
│       └── TaskStorage.test.ts                 # Triple indexing, archive chunking, GlobalFilter
│
├── package.json
├── tsconfig.json                               # @/* → ./src/* path alias
├── vite.config.ts                              # Build to dist/
├── vitest.config.ts                            # jsdom environment; src/**/*.test.ts + tests/**/*.test.ts
└── README.md




┌─────────────────────────────────────────────────────────────┐
│                       index.ts (Plugin Entry)               │
│                onload() → addDock() → TaskManager.init()    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│              TaskManager (Singleton Orchestrator)            │
│   Init Order: Settings → Storage → Events → Scheduler → AI │
└──┬──────────┬──────────┬──────────┬──────────┬──────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌───────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──────────────────┐
│Storage│ │EventSvc│ │Scheduler│ │Parser│ │SmartSuggestion   │
│       │ │        │ │         │ │      │ │Engine (AI)       │
│MemMap │ │Notif   │ │task:due │ │Emoji │ │Abandonment       │
│Archive│ │State   │ │task:over│ │NLP   │ │Reschedule        │
│3xIndex│ │Reactions│ │Timezone │ │Bidir │ │Urgency/Frequency │
└───┬───┘ └───┬────┘ └────┬────┘ └──┬───┘ └──────────────────┘
    │         │            │         │
    │         ▼            ▼         ▼
    │    ┌─────────┐  ┌──────────┐ ┌───────────────┐
    │    │Webhook  │  │Recurrence│ │InlineToggle   │
    │    │Emitter  │  │Calculator│ │Handler(100ms) │
    │    │Queue    │  │RRULE     │ └───────────────┘
    │    │Retry    │  │Forward   │
    │    │Signature│  │Progress  │
    │    └─────────┘  └──────────┘
    │
    ▼
┌──────────────────────┐
│  SiYuan Plugin API   │
│  fetchPost()         │
│  Block Attributes    │
│  BLOCK_ATTR_* const  │
└──────────────────────┘