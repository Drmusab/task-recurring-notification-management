# Dashboard Integration Architecture

## Overview

The Recurring Task Dashboard provides a persistent interface for creating and editing recurring tasks. This document describes the architecture and data flow.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │            RecurringDashboardView                         │  │
│  │  (Dashboard container - mounts TaskEditorModal)           │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│  ┌────────────────────▼─────────────────────────────────────┐  │
│  │            TaskEditorModal.svelte                         │  │
│  │  (Existing task editor component)                         │  │
│  │                                                            │  │
│  │  - Name, Description                                       │  │
│  │  - Priority Selector                                       │  │
│  │  - Status Selector                                         │  │
│  │  - Date Inputs (due, scheduled, start)                     │  │
│  │  - Recurrence Input                                        │  │
│  │  - Dependency Picker                                       │  │
│  │  - Block Actions Editor                                    │  │
│  └────────────────────┬─────────────────────────────────────┘  │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        │ Task data
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                      Adapter Layer                                │
│                                                                   │
│  ┌───────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ TaskDraftAdapter  │  │  TaskValidator   │  │StatusAdapter │  │
│  │                   │  │                  │  │              │  │
│  │ - taskToTaskDraft │  │ - validateTask   │  │ - symbol↔️   │  │
│  │ - taskDraftToTask │  │ - getFieldError  │  │   status     │  │
│  └───────────────────┘  └──────────────────┘  └──────────────┘  │
└───────────────────────┬──────────────────────────────────────────┘
                        │
                        │ Validated Task
                        │
┌───────────────────────▼──────────────────────────────────────────┐
│                    Business Logic Layer                          │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              TaskRepository                               │   │
│  │  - saveTask()                                             │   │
│  │  - getAllTasks()                                          │   │
│  │  - deleteTask()                                           │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                           │
│  ┌────────────────────▼─────────────────────────────────────┐   │
│  │              Scheduler                                     │   │
│  │  (RecurrenceEngineRRULE)                                  │   │
│  │  - Schedule recurring instances                           │   │
│  │  - Handle timezone conversions                            │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                           │
│  ┌────────────────────▼─────────────────────────────────────┐   │
│  │              Storage                                       │   │
│  │  - Persist to SiYuan storage                              │   │
│  └───────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### RecurringDashboardView
- Mounts and unmounts the TaskEditorModal in a persistent container
- Manages dashboard lifecycle
- Handles view refresh after task save/close
- Provides dashboard-specific styling

### TaskEditorModal (Existing Component)
- Handles all form interactions
- Validates user input in real-time
- Manages form state
- Integrates with PatternLearner for AI suggestions
- Handles dependency cycle detection
- Emits events on save/close

### Adapter Layer

#### TaskDraftAdapter
- Converts between UI model (TaskDraft) and business model (Task)
- Normalizes priority values
- Handles recurrence text parsing
- Ensures data consistency

#### TaskValidator
- Validates all task fields
- Checks date ordering constraints
- Validates recurrence patterns
- Prevents self-dependencies
- Returns structured error messages

#### StatusAdapter
- Maps status symbols (' ', 'x', '-') to status types
- Compatible with 1-Tasks format
- Provides helper functions for status checks

### Business Logic Layer

#### TaskRepository
- CRUD operations for tasks
- Manages task persistence
- Maintains task indexes

#### Scheduler (RecurrenceEngineRRULE)
- Calculates next occurrence dates
- Handles RRULE-based recurrence
- Manages timezone conversions
- Supports complex recurrence patterns

## Data Flow

### Task Creation Flow

```
User fills form
    ↓
TaskEditorModal validates input
    ↓
TaskValidator.validateTaskDraft()
    ↓
TaskDraftAdapter.taskDraftToTask()
    ↓
RecurrenceParser.parse()
    ↓
TaskRepository.saveTask()
    ↓
Scheduler.scheduleRecurrences()
    ↓
Storage persists data
    ↓
Event emitted: "task:refresh"
    ↓
UI refreshes → Form resets
```

### Task Editing Flow

```
Load existing task
    ↓
TaskDraftAdapter.taskToTaskDraft()
    ↓
Populate form fields
    ↓
User edits form
    ↓
TaskEditorModal validates input
    ↓
TaskValidator.validateTaskDraft()
    ↓
TaskDraftAdapter.taskDraftToTask()
    ↓
Merge with existing task data
    ↓
TaskRepository.saveTask()
    ↓
Scheduler.updateSchedule()
    ↓
Storage persists changes
    ↓
Event emitted: "task:refresh"
    ↓
UI refreshes
```

## Separation of Concerns

### Presentation Layer (UI)
- TaskEditorModal handles user interactions
- RecurringDashboardView manages view lifecycle
- No direct business logic

### Adapter Layer
- Converts between UI and business models
- Validates data integrity
- Provides type-safe transformations
- No side effects

### Business Layer
- TaskRepository handles CRUD operations
- Scheduler manages recurrence logic
- Storage handles persistence
- Emits domain events

## Benefits of This Architecture

1. **Separation of Concerns**: UI, adaptation, and business logic are clearly separated
2. **Testability**: Each layer can be tested independently
3. **Maintainability**: Changes to one layer don't affect others
4. **Type Safety**: TypeScript interfaces ensure data consistency
5. **Reusability**: Adapters and validators can be used elsewhere
6. **Minimal Changes**: Reuses existing TaskEditorModal component

## Future Enhancements

Potential areas for extension:

1. **Additional UI Components**: Could extract and integrate more 1-Tasks components
2. **Advanced Validation**: Could add cross-field validation rules
3. **Caching**: Could add caching layer for frequently accessed tasks
4. **Optimistic Updates**: Could implement optimistic UI updates
5. **Offline Support**: Could add offline queue for task operations
