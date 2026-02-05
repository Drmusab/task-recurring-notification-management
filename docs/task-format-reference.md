# Task Format Reference

Complete reference for task line syntax with all metadata fields supported by the Recurring Task Management plugin.

## Overview

Tasks can be formatted using either emoji or text-based metadata. This guide covers both formats and all available metadata fields.

---

## Emoji Format (Default)

The emoji format uses visual icons to represent task metadata, making it easy to scan and understand at a glance.

### Basic Task

```
- [ ] Task description
```

### Complete Task with All Metadata

```
- [ ] Task description 📅 2025-01-20 ⏳ 2025-01-18 🛫 2025-01-15 🔁 every week ⏫ #work 🆔 task123 ⛔ task456 🏁 delete
```

---

## Date Fields

### 📅 Due Date

When the task must be completed.

**Examples:**
- `📅 2025-01-20` - Due on January 20, 2025
- `📅 2025-01-20T14:00` - Due at 2:00 PM on January 20, 2025

### ⏳ Scheduled Date

When you plan to work on the task.

**Examples:**
- `⏳ 2025-01-18` - Scheduled to work on January 18, 2025
- `⏳ today` - Scheduled for today
- `⏳ tomorrow` - Scheduled for tomorrow

### 🛫 Start Date

When the task becomes relevant or actionable.

**Examples:**
- `🛫 2025-01-15` - Can start working on January 15, 2025
- `🛫 next week` - Starts next week

### ➕ Created Date

Automatically added when task is created (if enabled in settings).

**Example:**
- `➕ 2025-01-10` - Task was created on January 10, 2025

### ✅ Done Date

Automatically added when task is marked as complete.

**Example:**
- `✅ 2025-01-20` - Task was completed on January 20, 2025

### ❌ Cancelled Date

Automatically added when task is cancelled.

**Example:**
- `❌ 2025-01-19` - Task was cancelled on January 19, 2025

---

## Priority Levels

Priority helps determine task importance and urgency.

| Emoji | Level   | Description                    |
|-------|---------|--------------------------------|
| 🔺    | Highest | Critical, urgent tasks         |
| ⏫    | High    | Important tasks                |
| 🔼    | Medium  | Normal priority with emphasis  |
| (none)| Normal  | Default priority               |
| 🔽    | Low     | Lower priority tasks           |
| ⏬    | Lowest  | Minimal priority tasks         |

**Examples:**
- `- [ ] Critical bug fix 🔺`
- `- [ ] Important meeting ⏫`
- `- [ ] Low priority task 🔽`

---

## Recurrence Patterns

The `🔁` emoji indicates a recurring task. Use natural language to define recurrence rules.

### Daily Recurrence

```
🔁 every day
🔁 every 2 days
🔁 every 3 days
```

### Weekly Recurrence

```
🔁 every week
🔁 every week on Monday
🔁 every week on Monday, Friday
🔁 every 2 weeks on Tuesday
```

### Monthly Recurrence

```
🔁 every month
🔁 every month on the 15th
🔁 every 2 months on the 1st
🔁 every month on the last day
```

### Yearly Recurrence

```
🔁 every year
🔁 every year on January 1st
🔁 every 2 years
```

### When Done (Completion-Based)

Add `when done` to calculate the next occurrence from the completion date instead of the original due date.

```
🔁 every day when done
🔁 every week when done
🔁 every 2 weeks when done
```

**Use case:** Tasks that must maintain a specific interval between completions (e.g., "Water plants every 3 days").

---

## Task Dependencies

Define task relationships to create workflows.

### 🆔 Task ID

Unique identifier for the task. Required for dependencies.

**Example:**
- `🆔 abc123`

### ⛔ Depends On

List of task IDs that must be completed before this task.

**Examples:**
- `⛔ abc123` - Depends on one task
- `⛔ abc123,def456` - Depends on multiple tasks

**Full Example:**
```
- [ ] Task A 🆔 taskA
- [ ] Task B 🆔 taskB ⛔ taskA
- [ ] Task C 🆔 taskC ⛔ taskA,taskB
```

In this example:
- Task B cannot start until Task A is complete
- Task C cannot start until both Task A and Task B are complete

---

## On Completion Behavior

The `🏁` emoji controls what happens to a task when it's completed.

### 🏁 keep (default)

Keep the completed task instance and create a new one for the next occurrence.

**Example:**
- `- [ ] Daily standup 🔁 every day 🏁 keep`

**Result:** After completion, you'll see:
- The completed task marked as done
- A new task for the next day

### 🏁 delete

Delete the completed task instance after creating the next occurrence.

**Example:**
- `- [ ] Weekly review 🔁 every week 🏁 delete`

**Result:** After completion:
- The completed task is deleted
- A new task for next week is created

**Use case:** Keeps your task list clean by removing completed instances.

---

## Tags

Use hashtags to categorize and filter tasks.

**Examples:**
- `#work` - Work-related task
- `#personal` - Personal task
- `#project/alpha` - Project-specific task with namespace
- `#context/home` - Location-based context

**Multiple tags:**
```
- [ ] Review presentation #work #urgent #project/launch
```

---

## Text Format (Alternative)

For users who prefer plain text, metadata can be specified using brackets:

```
- [ ] Task description [due:: 2025-01-20] [scheduled:: 2025-01-18] [recurrence:: every week] [priority:: high]
```

### Available Text Fields

| Field         | Syntax                      | Example                  |
|---------------|-----------------------------|--------------------------|
| Due           | `[due:: DATE]`              | `[due:: 2025-01-20]`     |
| Scheduled     | `[scheduled:: DATE]`        | `[scheduled:: today]`    |
| Start         | `[start:: DATE]`            | `[start:: tomorrow]`     |
| Recurrence    | `[recurrence:: PATTERN]`    | `[recurrence:: weekly]`  |
| Priority      | `[priority:: LEVEL]`        | `[priority:: high]`      |
| On Completion | `[onCompletion:: ACTION]`   | `[onCompletion:: delete]`|

---

## Status Symbols

Tasks use different checkbox symbols to indicate their status:

| Symbol | Status       | Description                  |
|--------|--------------|------------------------------|
| [ ]    | TODO         | Not started                  |
| [/]    | IN_PROGRESS  | Currently working on         |
| [x]    | DONE         | Completed                    |
| [-]    | CANCELLED    | Cancelled or abandoned       |
| [>]    | FORWARDED    | Moved to another date        |
| [<]    | SCHEDULED    | Scheduled for later          |
| [!]    | IMPORTANT    | Flagged as important         |
| [?]    | QUESTION     | Needs clarification          |
| [*]    | STAR         | Starred/bookmarked           |
| ["]    | QUOTE        | Quoted or referenced         |
| [l]    | LOCATION     | Location-specific            |
| [b]    | BOOKMARK     | Bookmarked                   |
| [i]    | INFORMATION  | Informational                |
| [S]    | SAVINGS      | Cost/time saving             |
| [I]    | IDEA         | Idea or suggestion           |
| [p]    | PRO          | Pro/advantage                |
| [c]    | CON          | Con/disadvantage             |
| [f]    | FIRE         | Urgent/on fire               |
| [k]    | KEY          | Key/critical                 |
| [w]    | WIN          | Win/achievement              |
| [u]    | UP           | Upvoted/trending up          |
| [d]    | DOWN         | Downvoted/trending down      |

---

## Complete Examples

### Simple Daily Task

```
- [ ] Morning standup 📅 2025-01-20 🔁 every day
```

### Complex Project Task

```
- [ ] Deploy to production 📅 2025-01-20 ⏳ 2025-01-18 🛫 2025-01-15 🔺 #work #project/launch 🆔 deploy-prod ⛔ code-review,testing-complete
```

### Weekly Recurring with Delete on Completion

```
- [ ] Weekly team meeting 📅 2025-01-20 🔁 every week on Monday ⏫ #work #meetings 🏁 delete
```

### Task with All Date Fields

```
- [ ] Submit quarterly report 📅 2025-01-31 ⏳ 2025-01-25 🛫 2025-01-20 ➕ 2025-01-15 ⏫ #work #reports
```

---

## Settings Integration

### Enable/Disable Emoji Format

Go to **Settings → Task Format** to toggle between emoji and text formats.

### Customize Status Symbols

Go to **Settings → Status Definitions** to customize checkbox symbols and toggle cycle.

### Global Filter

Configure which checkboxes count as tasks:
- **Tag pattern:** Only checkboxes with specific tags (e.g., `#task`)
- **Path pattern:** Only checkboxes in specific folders (e.g., `tasks/`)
- **Regex pattern:** Advanced pattern matching

---

## Best Practices

1. **Be Consistent:** Choose either emoji or text format and stick with it
2. **Use Tags Wisely:** Create a tag hierarchy for better organization
3. **Set Priorities:** Use priority levels to focus on what matters
4. **Dependencies:** Model workflows with task dependencies
5. **Recurrence:** Use "when done" for maintenance tasks, regular schedule for deadlines
6. **On Completion:** Use "delete" to keep task list clean, "keep" to maintain history

---

## Quick Reference

```
📅 Due       ⏳ Scheduled  🛫 Start      ➕ Created
✅ Done      ❌ Cancelled  🔁 Recurrence 🏁 OnComplete
🔺 Highest   ⏫ High       🔼 Medium     🔽 Low        ⏬ Lowest
🆔 Task ID   ⛔ Depends On
```

---

## See Also

- [Query Language Guide](./query-language.md) - How to query and filter tasks
- [Query Examples](./query-examples.md) - Common query patterns
- [Settings Guide](./settings-guide.md) - Configure plugin behavior
