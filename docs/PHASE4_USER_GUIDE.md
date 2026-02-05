# User Guide: Dashboard Tabs & Quick Filters

This guide explains the new dashboard features added in Phase 4.

## Dashboard Overview

The dashboard now features **9 tabs** for organizing your tasks:

### Tab Descriptions

#### 📥 Inbox
**Purpose:** Tasks that haven't been scheduled yet.

**Shows:** Tasks with no due date, scheduled date, or start date.

**Use case:** Capture new tasks quickly, then schedule them later from Inbox.

**Empty state:** "No tasks in inbox. Create your first task or schedule your existing tasks!"

---

#### 📋 Today
**Purpose:** Tasks requiring immediate attention.

**Shows:** 
- Tasks due today
- Overdue tasks (due before today)
- Tasks scheduled for today

**Features:**
- Sorted by priority
- Grouped by status type
- Quick complete/delay/skip actions

**Use case:** Your daily task list - what needs to be done now.

---

#### 📅 Upcoming
**Purpose:** Plan your week ahead.

**Shows:** Tasks due in the next 7 days (excludes today).

**Features:**
- Grouped by due date
- Visual date headers: "Tomorrow", "Wednesday, Jan 22 (in 4 days)"
- Timeline view of your week

**Use case:** Weekly planning and avoiding future overload.

---

#### ✅ Done
**Purpose:** Review completed work.

**Shows:** Tasks completed in the last 30 days.

**Features:**
- Pagination (50 tasks per page)
- "Undo" button to mark as not done
- Relative dates: "Today", "Yesterday", "3 days ago"

**Use case:** Track accomplishments, undo accidental completions.

---

#### 📁 Projects
**Purpose:** Organize tasks by location/folder.

**Shows:** Active tasks grouped by their folder path.

**Features:**
- Collapsible folder tree
- Task count per folder
- Expand All / Collapse All buttons
- Sorted by due date within each folder

**Use case:** Project-based task management, context switching between areas.

---

#### 🔍 Search
**Purpose:** Advanced task filtering with custom queries.

**Features:**
- Custom query language input
- Query history (last 10 saved)
- Example queries with one-click apply
- Execution time display
- Error messages for invalid syntax

**Example Queries:**
```
not done
due today
priority high
not done AND due before tomorrow
has tags
done after 7 days ago
status.type IN_PROGRESS
not done GROUP BY priority
```

**Use case:** Find specific tasks with complex criteria, save frequently used queries.

---

#### 📝 All Tasks
**Purpose:** Manage all tasks with bulk operations.

**Shows:** All tasks in the system.

**Features:**
- Search/filter
- Multi-select (checkbox)
- Bulk enable/disable/delete
- Full task details table

**Use case:** Bulk operations, comprehensive task review.

---

#### 📅 Timeline (Existing)
**Purpose:** Visual timeline of recurring tasks.

**Use case:** See recurring patterns and upcoming instances.

---

#### 📊 Analytics (Existing)
**Purpose:** Task statistics and insights.

**Use case:** Review performance metrics and trends.

---

## Quick Filters

Quick filters apply to most tabs (not Search, Timeline, or Analytics) and can be combined:

### Available Filters

| Filter | Shows Tasks That... |
|--------|---------------------|
| **Not Done** | Status ≠ done or cancelled |
| **Due Today** | Due date is today (00:00 to 23:59) |
| **Overdue** | Due date before today AND not done |
| **In Progress** | Have custom status symbols (started but not done) |
| **Blocked** | Have blockedBy dependencies |
| **High Priority** | Priority = high or urgent |

### How to Use

1. Select a tab (Inbox, Today, Upcoming, etc.)
2. Click one or more filter buttons
3. Filters turn blue when active
4. Tasks update instantly
5. Click again to deactivate a filter

**Example Workflow:**
- Go to **Today** tab
- Click **High Priority** filter
- See only urgent tasks for today
- Click **In Progress** to further filter to started tasks

---

## Keyboard Navigation

All tabs support keyboard-first navigation:

### Navigation Keys

- **↑ / ↓**: Move selection up/down through task list
- **Home**: Jump to first task
- **End**: Jump to last task
- **Enter**: Open task editor (edit task details)
- **Space**: Mark task as done (quick complete)

### Visual Feedback

- Selected task has blue outline
- Focus follows keyboard movement
- Smooth scrolling to keep focused task visible

**Tip:** Use keyboard navigation for rapid task triage - arrow down, space to complete, repeat!

---

## Refresh Button

Located next to the Settings button (⚙️).

**Purpose:** Manually reload tasks from storage.

**When to use:**
- After editing tasks in SiYuan editor
- When tasks don't appear to update
- After bulk operations in other apps

**Visual feedback:**
- Spinning icon during refresh
- Toast notification: "Task list reloaded"

---

## Task Counts (Badges)

Each tab shows a badge with the number of tasks:

- **Inbox (5)**: 5 unscheduled tasks
- **Today (3)**: 3 tasks due/overdue today
- **Upcoming (12)**: 12 tasks in next 7 days
- **Done (47)**: 47 tasks completed recently
- **Projects (25)**: 25 active tasks
- **All (100)**: 100 total tasks

**Use case:** Quick overview of task distribution without switching tabs.

---

## Tips & Tricks

### Inbox Zero Workflow
1. Create new tasks quickly in Inbox
2. Periodically review Inbox tab
3. Add due dates and move tasks to Today/Upcoming
4. Keep Inbox empty for peace of mind

### Daily Review
1. Start day in **Today** tab
2. Complete high-priority tasks first
3. Delay non-critical tasks to tomorrow
4. Check **Upcoming** to plan ahead

### Weekly Planning
1. Monday: Review **Upcoming** tab
2. Adjust due dates for realistic schedule
3. Use **Projects** tab for context-specific work
4. Use **Done** tab Friday to review accomplishments

### Power User Query Examples

In **Search** tab:

```
# All incomplete tasks due this week
not done AND due before 7 days from today

# High priority tasks without dependencies
priority high AND NOT (has blockedBy)

# Recently created tasks
created after 3 days ago

# Tasks grouped by priority
not done GROUP BY priority

# Tasks in specific folder
path contains "work/projects"
```

### Keyboard Shortcuts (Global)

| Shortcut | Action |
|----------|--------|
| ⌘⇧T | Open Recurring Tasks dock |
| ⌘⇧R | Create new task |
| ⌘⇧D | Quick complete next task |
| ⌘⇧N | Quick add task |
| ⌘⇧E | Open task editor |
| ⌘⇧X | Toggle task status |

**Note:** Mac uses ⌘ (Command), Windows/Linux uses Ctrl.

---

## Troubleshooting

### Tasks not appearing in tabs?
- Click the Refresh button (↻)
- Check Quick Filters - disable all to see all tasks
- Verify task has correct dates for the tab (e.g., Inbox needs no dates)

### Search queries not working?
- Check query syntax - see example queries
- Look for red error message below input
- Click example queries to see correct format

### Keyboard navigation not working?
- Click on a task card first to set focus
- Ensure you're not in an input field
- Try clicking on the tab content area

### Task counts seem wrong?
- Refresh the dashboard
- Check if tasks are filtered
- Verify task status (done/cancelled don't count in most tabs)

---

## Frequently Asked Questions

**Q: How do I move a task from Inbox to Today?**
A: Edit the task and add a due date for today. It will automatically appear in Today tab.

**Q: Can I change the number of days in Upcoming?**
A: Currently set to 7 days. This may be configurable in future versions.

**Q: How many tasks show in Done tab?**
A: 50 per page, for tasks completed in last 30 days.

**Q: Can I save custom search queries?**
A: Query history saves your last 10 queries automatically. Saved queries feature coming soon.

**Q: Do Quick Filters work in Search tab?**
A: No, Search tab has its own query language. Quick Filters work in Inbox, Today, Upcoming, Done, Projects, and All tabs.

**Q: What happens when I Undo a completed task?**
A: The task moves back to its original tab based on due date (Today, Upcoming, or Inbox).

---

## Next Steps

1. **Try each tab** to understand what tasks appear where
2. **Experiment with Quick Filters** to find your workflow
3. **Learn basic Search queries** for power user filtering
4. **Use keyboard navigation** to speed up task management
5. **Review Done tab weekly** to track accomplishments

Happy task managing! 🚀
