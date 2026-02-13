# Backend Architecture

This directory contains the core business logic and data management for the Shehab-Note recurring task plugin.

## Directory Structure

```
backend/
├── api/                      # External API adapters
│   └── SiYuanApiAdapter.ts   # SiYuan API integration layer
├── blocks/                   # Block-related operations
│   ├── blocks.ts             # Block fetching and preview utilities
│   └── bulk-operations.ts    # Bulk block processing
├── commands/                 # Command handlers and registry
│   ├── handlers/             # Individual command handlers
│   ├── BlockHandler.ts       # Block command processing
│   ├── BlockNormalizer.ts    # Block normalization logic
│   ├── CommandRegistry.ts    # Central command registry
│   ├── CreateTaskFromBlock.ts # Task creation from blocks
│   ├── InlineToggleHandler.ts # Checkbox toggle handling
│   ├── ShortcutManager.ts    # Keyboard shortcut management
│   └── TaskCommands.ts       # Task-specific commands
├── core/                     # Core domain logic
│   ├── actions/              # Task action handlers (complete, delete, etc.)
│   ├── ai/                   # AI-driven features (suggestions, scoring)
│   ├── analytics/            # Task analytics and calculations
│   ├── api/                  # Domain API layer
│   ├── block-actions/        # Block event triggers and actions
│   ├── engine/               # Scheduling and recurrence engine
│   │   ├── recurrence/       # Recurrence calculation (RRULE)
│   │   ├── DependencyGraph.ts # Task dependency management
│   │   ├── NotificationState.ts # Notification tracking
│   │   ├── OnCompletion.ts   # Completion handlers
│   │   ├── Scheduler.ts      # Main scheduling engine
│   │   ├── SchedulerTimer.ts # Timer management
│   │   └── TimezoneHandler.ts # Timezone normalization
│   ├── escalation/           # Task escalation logic
│   ├── global-filter/        # Global task filtering
│   ├── inline-query/         # Inline query processing
│   ├── integration/          # External integrations
│   ├── managers/             # Lifecycle managers
│   │   └── TaskManager.ts    # Main task lifecycle manager
│   ├── ml/                   # Machine learning features
│   ├── models/               # Domain models
│   │   ├── Task.ts           # Task entity (canonical)
│   │   └── Frequency.ts      # Recurrence frequency types
│   ├── parsers/              # Text parsing (dates, recurrence, inline)
│   │   ├── DateParser.ts     # Natural language date parsing
│   │   ├── InlineTaskParser.ts # Inline markdown task parsing
│   │   ├── NaturalRecurrenceParser.ts # Natural recurrence parsing
│   │   ├── RecurrenceParser.ts # RRULE recurrence parsing
│   │   ├── TaskLineParser.ts # Task line parsing
│   │   └── TaskLineSerializer.ts # Task line serialization
│   ├── query/                # Query engine and filters
│   ├── settings/             # Settings management
│   ├── storage/              # Data persistence layer
│   │   ├── migrations/       # Schema migrations
│   │   ├── ActiveTaskStore.ts # Active tasks storage
│   │   ├── ArchiveTaskStore.ts # Archived tasks storage
│   │   ├── MigrationManager.ts # Migration orchestration
│   │   ├── TaskIndex.ts      # Task indexing
│   │   ├── TaskPersistenceController.ts # Debounced persistence
│   │   ├── TaskRepository.ts # Repository pattern
│   │   └── TaskStorage.ts    # Main storage facade
│   └── ui/                   # UI state management
│       ├── AnimationQueue.ts # UI animation coordination
│       ├── OptimisticUpdateManager.ts # Optimistic UI updates
│       └── TaskUIState.ts    # Task UI state tracking
├── events/                   # Event system
│   ├── EventQueue.ts         # Event queue implementation
│   ├── EventSubscriptionManager.ts # Webhook subscriptions
│   └── ...
├── features/                 # Feature implementations
│   ├── AutoTaskCreator.ts    # Automatic task creation
│   └── EmojiStatusUpdater.ts # Status emoji synchronization
├── integrations/             # External service integrations
│   └── reminders/            # Reminders integration
├── logging/                  # Logging infrastructure
│   ├── logger.ts             # Main logger (canonical)
│   ├── ErrorLogger.ts        # Error logging
│   └── performance-profiler.ts # Performance profiling
├── parsers/                  # Additional parsers
├── recurrence/               # Recurrence utilities
├── services/                 # Application services
│   ├── EventService.ts       # Event orchestration service
│   └── types.ts              # Service type definitions
└── webhooks/                 # Webhook infrastructure
    ├── inbound/              # Incoming webhooks
    │   └── middleware/       # Request middleware
    ├── outbound/             # Outgoing webhooks
    │   ├── OutboundWebhookEmitter.ts # Webhook sender
    │   ├── RetryManager.ts   # Retry logic
    │   └── SignatureGenerator.ts # Webhook signatures
    └── types/                # Webhook type definitions
```

## Key Concepts

### Singleton Pattern
Most managers use the singleton pattern. Always access via `getInstance()`:

```typescript
import { TaskManager } from '@backend/core/managers/TaskManager';

const manager = TaskManager.getInstance(plugin);
```

### Import Paths
Use absolute imports with path aliases:

```typescript
// ✅ Correct
import { DateParser } from '@backend/core/parsers/DateParser';
import { Task } from '@backend/core/models/Task';
import * as logger from '@backend/logging/logger';

// ❌ Avoid
import { DateParser } from '../../../parsers/DateParser';
```

### Layer Separation
- **Backend** - Business logic, data access, external integrations
- **Frontend** - UI components, user interactions
- **Shared** - Common utilities, types, constants

**Never import frontend code in backend.**

## Architecture Patterns

### Repository Pattern
Data access is abstracted through repositories:

```typescript
TaskStorage → TaskRepository → ActiveTaskStore/ArchiveTaskStore
```

### Event-Driven
The scheduler emits semantic events that services react to:

```typescript
Scheduler → emit('task:due') → EventService → OutboundWebhookEmitter
```

### Dependency Injection
Services are injected via constructors or getInstance parameters:

```typescript
new Scheduler(storage, eventService, settings)
```

## Testing
- Unit tests: Co-located with source files (`*.test.ts`)
- Integration tests: `tests/integration/`
- Security tests: `tests/security/`

## Related Documentation
- [Architecture Diagram](../docs/integration/architecture-diagram.md)
- [Data Flow](../docs/integration/data-flow.md)
- [AI Features](../docs/AI_FEATURES.md)
