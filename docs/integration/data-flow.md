# Data Flow Documentation

## Overview

This document describes the complete data flow through the Recurring Task Dashboard system, from user input to persistence.

## Task Creation Data Flow

### Step 1: User Input
```typescript
User Action: Fill out task form in TaskEditorModal
- Name: "Weekly team meeting"
- Priority: "high"
- Status: "todo"
- Due At: "2026-02-03T10:00"
- Recurrence: "every monday at 10am"
```

### Step 2: Real-time Validation
```typescript
TaskEditorModal → Local State Validation
├─ nameError = !name.trim() ? "Required" : ""
├─ dueAtError = isNaN(Date.parse(dueAt)) ? "Invalid" : ""
└─ recurrenceError = !recurrenceValid ? "Invalid pattern" : ""

→ Form enables/disables submit based on errors
```

### Step 3: Form Submission
```typescript
User Action: Click "Save" button

TaskEditorModal.handleSave()
├─ Mark all fields as touched
├─ Check for validation errors
└─ If valid → Proceed to save
```

### Step 4: Data Preparation
```typescript
// TaskEditorModal creates partial Task
{
  id: undefined,  // New task
  name: "Weekly team meeting",
  description: "",
  priority: "high",
  status: "todo",
  dueAt: "2026-02-03T10:00:00.000Z",
  scheduledAt: undefined,
  startAt: undefined,
  recurrenceText: "every monday at 10am",
  frequency: null,  // Will be parsed
  whenDone: false,
  blockedBy: [],
  dependsOn: [],
  blockActions: [],
  updatedAt: "2026-01-28T05:45:17.383Z"
}
```

### Step 5: Recurrence Parsing
```typescript
RecurrenceParser.parse("every monday at 10am")
↓
{
  type: "weekly",
  interval: 1,
  weekdays: [1],  // Monday
  time: "10:00",
  timezone: "UTC",
  rruleString: "FREQ=WEEKLY;BYDAY=MO",
  dtstart: "2026-02-03T10:00:00.000Z"
}
```

### Step 6: Task Creation
```typescript
createTask(name, frequency, dueDate)
↓
{
  id: "task_abc123",  // Generated UUID
  name: "Weekly team meeting",
  frequency: { type: "weekly", ... },
  dueAt: "2026-02-03T10:00:00.000Z",
  enabled: true,
  status: "todo",
  priority: "high",
  recurrenceText: "every monday at 10am",
  createdAt: "2026-01-28T05:45:17.383Z",
  updatedAt: "2026-01-28T05:45:17.383Z",
  version: 5,  // Current schema version
  completionCount: 0,
  missCount: 0,
  currentStreak: 0,
  bestStreak: 0,
  recentCompletions: []
}
```

### Step 7: Dependency Validation
```typescript
if (task.dependsOn && task.dependsOn.length > 0) {
  DependencyIndex.build(allTasks)
  ↓
  CycleDetector.findCycleFrom(task.id)
  ↓
  If cycle found → Error or Warning
  If no cycle → Continue
}
```

### Step 8: Persistence
```typescript
TaskRepository.saveTask(task)
├─ Validate task data
├─ Update block index
├─ Update due date index
├─ Persist to storage
└─ Emit "task:refresh" event
```

### Step 9: Recurrence Scheduling
```typescript
Scheduler.scheduleRecurrences(task)
├─ RecurrenceEngineRRULE.getNextOccurrence(task)
├─ Calculate next due date
├─ Handle timezone conversion
└─ Return next occurrence info
```

### Step 10: UI Update
```typescript
Event: "task:refresh"
↓
Dashboard.refresh()
├─ Reload tasks from repository
├─ Update task lists
├─ Reset form
└─ Show success toast
```

## Task Editing Data Flow

### Step 1: Load Task for Editing
```typescript
User Action: Click "Edit" on existing task

RecurringDashboardView.loadTask(task)
↓
TaskDraftAdapter.taskToTaskDraft(task)
↓
{
  id: "task_abc123",
  name: "Weekly team meeting",
  description: "",
  priority: "high",
  status: "todo",
  dueAt: "2026-02-03T10:00:00.000Z",
  recurrenceText: "every monday at 10am",
  ... // Other fields
}
```

### Step 2: Populate Form
```typescript
TaskEditorModal receives task prop
↓
Form fields populated from task data
├─ name = task.name
├─ priority = task.priority
├─ dueAt = formatDate(task.dueAt)
├─ recurrenceText = task.recurrenceText
└─ ... all other fields
```

### Step 3: User Edits
```typescript
User Action: Change recurrence to "every 2 weeks on monday"

RecurrenceInput.handleChange()
├─ recurrenceText = "every 2 weeks on monday"
├─ RecurrenceParser.parse(recurrenceText)
├─ recurrenceFrequency = { type: "weekly", interval: 2, ... }
└─ recurrenceValid = true
```

### Step 4: Validation
```typescript
TaskValidator.validateTaskDraft(draft)
↓
{
  valid: true,
  errors: []
}

Or if invalid:
{
  valid: false,
  errors: [
    { field: "dueAt", message: "Due date is required" },
    { field: "startAt", message: "Start date must be before due date" }
  ]
}
```

### Step 5: Save Changes
```typescript
TaskEditorModal.handleSave()
├─ Merge edited data with existing task
├─ updatedTask = { ...existingTask, ...editedFields }
├─ updatedTask.updatedAt = new Date().toISOString()
└─ TaskRepository.saveTask(updatedTask)
```

### Step 6: Update Schedule
```typescript
Scheduler.updateSchedule(updatedTask)
├─ Recalculate next occurrence
├─ Update frequency if changed
└─ Preserve completion history
```

### Step 7: Refresh UI
```typescript
pluginEventBus.emit("task:refresh")
↓
Dashboard components react to event
├─ Reload task lists
├─ Update badges/counts
└─ Show "Task updated" toast
```

## Status Transitions

### Mark Task as Done
```typescript
User Action: Change status to "done"

TaskEditorModal
├─ status = "done"
├─ If !task.lastCompletedAt → set to now
├─ doneAt = new Date().toISOString()
└─ Save task

↓
Scheduler.scheduleNext(task)
├─ Calculate next occurrence
├─ Create new task instance (if recurring)
├─ Update completion stats
│   ├─ completionCount++
│   ├─ currentStreak++
│   └─ recentCompletions.push(now)
└─ Reset current instance or archive
```

### Cancel Task
```typescript
User Action: Change status to "cancelled"

TaskEditorModal
├─ status = "cancelled"
├─ cancelledAt = new Date().toISOString()
└─ Save task

↓
Task is excluded from active task queries
```

## Dependency Resolution

### Check Dependencies Before Completion
```typescript
User attempts to mark task as done

DependencyIndex.getBlockedBy(taskId)
↓
If blockedBy.length > 0:
  ├─ Check each blocking task
  ├─ If any blocking task is not done
  │   └─ Show warning: "Task is blocked by: [list]"
  └─ Allow completion with warning (configurable)
Else:
  └─ Allow completion
```

### Cascade Dependency Updates
```typescript
Task A completes
↓
DependencyIndex.getBlocks(taskId)
↓
For each blocked task:
  ├─ Check if all blocking tasks are done
  ├─ If yes → Mark as unblocked
  └─ Emit "dependency:resolved" event
```

## AI Suggestions Data Flow

### Pattern Learning
```typescript
Task completed
↓
PatternLearner.recordCompletion(task, completionTime)
├─ Store completion context
│   ├─ dayOfWeek
│   ├─ hourOfDay
│   ├─ wasOverdue
│   └─ delayMinutes
├─ Update learning metrics
└─ Generate suggestions if threshold met
```

### Apply Suggestion
```typescript
User clicks "Apply suggestion"

PatternLearner.buildFrequencyFromSuggestion(suggestion)
↓
New frequency with optimized schedule
↓
TaskEditorModal updates recurrence fields
├─ Store previous values for undo
├─ Update recurrenceText
├─ Update recurrenceFrequency
└─ Show undo toast (5 second countdown)
```

### Undo Suggestion
```typescript
User clicks "Undo" within 5 seconds

Restore snapshot:
├─ frequency = previousFrequency
├─ recurrenceText = previousText
├─ whenDone = previousWhenDone
└─ Save and refresh
```

## Error Handling

### Validation Errors
```typescript
ValidationError occurred
↓
TaskValidator returns error details
↓
UI shows inline error message
└─ Disable save button until fixed
```

### Save Errors
```typescript
Repository.saveTask() fails
↓
Catch error in TaskEditorModal
├─ toast.error("Failed to save task: [reason]")
├─ Keep form open
└─ Allow user to retry or cancel
```

### Dependency Cycle Errors
```typescript
Circular dependency detected
↓
If cycleHandlingMode === "warn":
  ├─ Show warning toast
  └─ Allow save
If cycleHandlingMode === "block":
  ├─ Show error toast
  └─ Prevent save
```

## Performance Optimizations

### Debounced Validation
```typescript
User types in recurrence field
↓
Debounce input (300ms)
↓
RecurrenceParser.parse()
↓
Update validation state
```

### Lazy Loading
```typescript
Dashboard opened
↓
Load only visible tasks initially
↓
Load more as user scrolls
```

### Index-Based Queries
```typescript
Query tasks by status
↓
Use TaskIndex (in-memory)
├─ O(1) lookup by status
└─ Avoid full repository scan
```

## Data Persistence Format

Tasks are stored in SiYuan storage as JSON:

```json
{
  "task_abc123": {
    "id": "task_abc123",
    "name": "Weekly team meeting",
    "frequency": {
      "type": "weekly",
      "interval": 1,
      "weekdays": [1],
      "time": "10:00",
      "rruleString": "FREQ=WEEKLY;BYDAY=MO"
    },
    "dueAt": "2026-02-03T10:00:00.000Z",
    "status": "todo",
    "priority": "high",
    "recurrenceText": "every monday at 10am",
    "createdAt": "2026-01-28T05:45:17.383Z",
    "updatedAt": "2026-01-28T05:45:17.383Z",
    "version": 5
  }
}
```

## Summary

The data flow ensures:
1. **Type Safety**: TypeScript interfaces at every layer
2. **Validation**: Multiple validation points prevent bad data
3. **Consistency**: Adapter layer ensures model compatibility
4. **Traceability**: Events allow tracking changes
5. **Error Recovery**: Graceful error handling at each step
