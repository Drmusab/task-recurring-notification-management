# Architectural Decision Records (ADR)

This document records key architectural decisions made during the development and refactoring of the Shehab-Note recurring task management plugin.

---

## ADR-001: Three-Layer Architecture

**Date:** February 2026  
**Status:** Accepted  
**Context:**

The codebase grew organically with mixed concerns, leading to:
- Business logic scattered across UI components
- Unclear separation between layers
- Difficulty testing business logic independently
- Import confusion (circular dependencies)

**Decision:**

Adopt a strict 3-layer architecture:

```
Backend (Business Logic)
    ↓ exports
Shared (Contracts, Types, Constants)
    ↓ exports
Frontend (Presentation)
```

**Consequences:**

**Positive:**
- Clear import rules: Frontend can import Backend/Shared, but not vice versa
- Shared cannot import Backend or Frontend
- Business logic testable without UI
- Single source of truth for domain models (Task, Frequency, etc.)

**Negative:**
- Requires discipline to maintain boundaries
- Some duplication of types across layers
- Learning curve for new contributors

**Implementation:**
- Moved all business logic to `src/backend/`
- UI components in `src/frontend/`
- Utilities and types in `src/shared/`
- Enforced via import path checks

---

## ADR-002: Path Aliases Over Relative Imports

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Relative imports created maintenance issues:
- Deep paths: `../../../backend/core/managers/TaskManager`
- Brittle when files move
- Hard to understand file relationships
- IDEs struggle with auto-imports

**Decision:**

Use TypeScript path aliases exclusively:

```typescript
@backend/* → src/backend/*
@frontend/* → src/frontend/*
@shared/* → src/shared/*
@components/* → src/frontend/components/*
@stores/* → src/frontend/stores/*
@hooks/* → src/frontend/hooks/*
@modals/* → src/frontend/modals/*
@views/* → src/frontend/views/*
```

**Consequences:**

**Positive:**
- Imports are location-independent
- Clear layer identification from import path
- Easier refactoring (move files without breaking imports)
- Better IDE auto-complete

**Negative:**
- Requires tsconfig.json and build tool configuration
- New developers need to learn alias system
- Some bundlers need special configuration

**Implementation:**
- Configured in `tsconfig.json` paths
- Vite configured to resolve aliases
- Update-imports.cjs script for batch updates

---

## ADR-003: Singleton Pattern for Managers

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Task lifecycle managers (TaskManager, Scheduler, etc.) need:
- Single instance across plugin lifecycle
- Centralized state management
- Predictable initialization order
- Access from multiple components

**Decision:**

Use singleton pattern for core managers:

```typescript
class TaskManager {
  private static instance: TaskManager | null = null;
  
  static getInstance(plugin: Plugin): TaskManager {
    if (!this.instance) {
      this.instance = new TaskManager(plugin);
    }
    return this.instance;
  }
  
  private constructor(plugin: Plugin) {
    // Initialize
  }
}
```

**Consequences:**

**Positive:**
- Guaranteed single instance
- Lazy initialization
- Easy access from anywhere
- Predictable lifecycle

**Negative:**
- Global state (harder to test)
- Potential coupling
- Cannot easily have multiple instances (e.g., for testing)

**Mitigation:**
- Use dependency injection where possible
- Provide getInstance() with plugin parameter for context
- Reset() method for testing

---

## ADR-004: Event-Driven Scheduler

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Task scheduling needs to trigger multiple actions:
- Send notifications (multiple channels)
- Update UI state
- Log events
- Emit webhooks

Directly calling services creates tight coupling.

**Decision:**

Use event-driven architecture for scheduler:

```typescript
scheduler.emit('task:due', { task, timestamp });
scheduler.emit('task:overdue', { task, missedCount });

// Services subscribe to events
eventService.on('task:due', (event) => {
  notificationService.notify(event.task);
  webhookService.emit(event);
});
```

**Consequences:**

**Positive:**
- Loose coupling between scheduler and services
- Easy to add new reactions to events
- Scheduler focused on timing, not side effects
- Better testability

**Negative:**
- Harder to trace execution flow
- Event ordering can be tricky
- More complex debugging

**Implementation:**
- EventService manages subscriptions
- Scheduler emits semantic events
- Services react to events independently

---

## ADR-005: Recurrence Engine with RRULE

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Recurrence calculations are complex:
- Edge cases (leap years, DST, month-end)
- Multiple formats (daily, weekly, monthly, yearly)
- Natural language parsing
- Timezone handling

**Decision:**

Use `rrule` library for recurrence calculations:

```typescript
import { RRule } from 'rrule';

const rule = new RRule({
  freq: RRule.DAILY,
  interval: 2,
  dtstart: new Date(2024, 0, 1)
});

const next = rule.after(new Date());
```

**Consequences:**

**Positive:**
- Battle-tested library (RFC 5545 compliant)
- Handles edge cases correctly
- Supports complex patterns
- Timezone-aware

**Negative:**
- External dependency
- Larger bundle size (~50KB)
- Learning curve for RRULE syntax

**Mitigation:**
- Wrap RRULE in RecurrenceEngineRRULE
- Provide natural language parser facade
- Cache RRULE instances for performance

---

## ADR-006: Kebab-Case File Naming

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Inconsistent file naming caused confusion:
- `TaskManager.ts` (PascalCase)
- `taskStorage.ts` (camelCase)
- `task-parser.ts` (kebab-case)

**Decision:**

Standardize on kebab-case for utilities and services, PascalCase for classes/components:

```
Classes/Components: TaskManager.ts, TaskModal.ts
Services: task-storage.service.ts or TaskStorageService.ts
Utilities: debounce.ts, fuzzy-search.ts
Stores: task-order.store.ts
Types: task.types.ts
```

**Consequences:**

**Positive:**
- Consistent naming reduces cognitive load
- Easy to identify file type from name
- URL-friendly (if served as static files)
- Matches web standards

**Negative:**
- Requires renaming many existing files
- Some conventions differ (e.g., React uses PascalCase)

**Implementation:**
- Phase 3 renamed 39 files
- linting rules enforce naming convention

---

## ADR-007: No "misc" or Generic Folders

**Date:** February 2026  
**Status:** Accepted  
**Context:**

`shared/utils/misc/` became a dumping ground:
- 18 unrelated files
- UI logic mixed with backend logic
- No clear categorization
- Hard to discover utilities

**Decision:**

Eliminate generic folders, use semantic categories:

```
shared/utils/
├── date/          # Date/time utilities
├── string/        # String manipulation
├── compat/        # Platform compatibility
├── search/        # Search utilities
├── function/      # Higher-order functions
└── task/          # Task-specific utilities
```

**Consequences:**

**Positive:**
- Discoverable organization
- Predictable import paths
- Clear purpose for each directory
- Prevents "junk drawer" accumulation

**Negative:**
- More directories to manage
- Need to decide categorization for new files

**Implementation:**
- Phase 2 reorganized 18 files from misc/
- Created 7 semantic directories
- Updated 120+ import statements

---

## ADR-008: Absolute Imports Only (No Relative)

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Relative imports are brittle and hard to refactor:
- `../../models/Task.ts` breaks when files move
- Difficult to determine actual location
- Long paths in deep directories

**Decision:**

Use absolute imports via path aliases exclusively:

```typescript
// ✅ Correct
import { Task } from '@backend/core/models/Task';

// ❌ Avoid
import { Task } from '../../models/Task';
```

**Exceptions:**
- Test files may use relative imports for co-located tests
- Internal barrel exports (index.ts)

**Consequences:**

**Positive:**
- Move files without breaking imports
- Clear file location from import path
- Easier to search for usages

**Negative:**
- Requires path alias configuration
- Learning curve for new developers

**Implementation:**
- Phase 4 updated 87+ imports
- Automated with fix-relative-imports.cjs script

---

## ADR-009: No Business Logic in Frontend

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Business logic leaked into frontend components:
- Task completion logic in task cards
- Date calculations in UI
- Validation in forms

This made:
- Testing difficult (need to render UI)
- Logic reuse impossible
- Backend/frontend coupling

**Decision:**

All business logic must live in backend layer:

```typescript
// ❌ Bad: Logic in component
function onComplete() {
  const nextDate = calculateNextOccurrence(task);
  task.scheduledDate = nextDate;
  storage.save(task);
}

// ✅ Good: Logic in backend service
import { completionHandler } from '@backend/core/actions/CompletionHandler';

function onComplete() {
  completionHandler.complete(task.id);
}
```

**Consequences:**

**Positive:**
- Testable without UI
- Reusable logic
- Single source of truth
- Clear separation of concerns

**Negative:**
- More indirection
- May feel over-engineered for simple cases

**Implementation:**
- Moved task actions to backend/core/actions/
- Created command handlers for all operations
- Frontend components only handle UI state

---

## ADR-010: Storage Layer Abstraction

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Direct SiYuan API calls scattered throughout codebase:
- Hard to test
- Tight coupling to SiYuan
- Difficult to add caching/optimization
- No migration strategy

**Decision:**

Abstract storage behind repository pattern:

```
TaskStorage (Facade)
    ↓
TaskRepository (Interface)
    ↓
ActiveTaskStore + ArchiveTaskStore
    ↓
SiYuan Storage API
```

**Consequences:**

**Positive:**
- Easy to test (mock repository)
- Can swap storage backends
- Centralized caching logic
- Migration path abstracted

**Negative:**
- Additional abstraction layer
- More boilerplate code

**Implementation:**
- TaskStorage.ts is the facade
- TaskRepository.ts defines interface
- Store implementations handle persistence
- MigrationManager handles schema changes

---

## ADR-011: Optimistic UI Updates

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Task actions (complete, delete, edit) had slow feedback:
- User clicks → wait for backend → UI updates
- Feels sluggish, especially on slower systems

**Decision:**

Implement optimistic updates:

```typescript
// 1. Immediately update UI
optimisticUpdateManager.apply(taskId, changes);

// 2. Persist in background
try {
  await storage.save(task);
  optimisticUpdateManager.commit(taskId);
} catch (error) {
  optimisticUpdateManager.rollback(taskId);
}
```

**Consequences:**

**Positive:**
- Instant user feedback
- Better perceived performance
- Smoother UX

**Negative:**
- Complex state management
- Need rollback logic
- Risk of showing stale data

**Implementation:**
- OptimisticUpdateManager tracks pending changes
- TaskUIState manages UI-only state
- AnimationQueue coordinates visual updates
- Rollback on errors

---

## ADR-012: Barrel Exports for Public APIs

**Date:** February 2026  
**Status:** Accepted  
**Context:**

Consumers had to know exact file locations:
- `import { X } from '@backend/core/models/Task'`
- `import { Y } from '@backend/core/models/Frequency'`

**Decision:**

Use index.ts barrel exports for modules:

```typescript
// backend/core/models/index.ts
export * from './Task';
export * from './Frequency';

// Consumer
import { Task, Frequency } from '@backend/core/models';
```

**Consequences:**

**Positive:**
- Cleaner imports
- Hide internal file structure
- Easy to reorganize internals

**Negative:**
- Can cause circular dependencies
- Larger bundle if not tree-shaken
- Need to maintain export lists

**Guidelines:**
- Use for 3+ related modules
- Don't re-export everything
- Document public API in barrel export

---

## Summary

These architectural decisions establish:

1. **Clear layering** - Backend, Frontend, Shared with strict import rules
2. **Semantic organization** - No generic folders, meaningful names
3. **Import consistency** - Absolute imports via path aliases
4. **Pattern consistency** - Singleton managers, event-driven scheduler
5. **Separation of concerns** - Business logic in backend, UI in frontend
6. **Maintainability** - Abstractions for storage, optimistic updates
7. **Developer experience** - Barrel exports, clear documentation

Together they create a maintainable, testable, and scalable codebase that can grow without accumulating technical debt.

---

**Related Documents:**
- [FINAL_REFACTORING_AUDIT.md](../FINAL_REFACTORING_AUDIT.md) - Complete audit results
- [PHASE2_COMPLETION_SUMMARY.md](../PHASE2_COMPLETION_SUMMARY.md) - Structural cleanup details
- [NAMING_CONVENTIONS.md](./NAMING_CONVENTIONS.md) - Naming standards
