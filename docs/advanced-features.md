# Advanced Features Guide

This guide covers the advanced power-user features of the recurring task management dashboard.

## Quick Search & Smart Filters

### Quick Search

The quick search bar allows you to instantly find tasks using fuzzy matching.

**Features:**
- Fuzzy search across task descriptions, tags, and notes
- Real-time results as you type
- Clear button to reset search (×)
- Keyboard shortcut: `Ctrl+K` to focus search

**Usage:**
1. Press `Ctrl+K` or click on the search bar
2. Start typing your search query
3. Results update instantly
4. Press `Esc` or click × to clear

### Smart Filters

Filter chips provide one-click access to common task views.

**Available Filters:**
- 📅 **Today** - Tasks due today
- ⚠️ **Overdue** - Past-due incomplete tasks
- 🔴 **High Priority** - High and highest priority tasks
- 🔄 **Recurring** - Tasks with recurrence rules
- 📌 **No Due Date** - Tasks without a due date
- ✅ **Completed** - Finished tasks

**Usage:**
1. Click on a filter chip to activate it
2. Active filters have a blue background
3. Click again to deactivate
4. Multiple filters combine with AND logic
5. Click "Clear All" to remove all filters

**Combining Search and Filters:**
- Search and filters work together
- Results show tasks matching both search query AND all active filters

---

## Drag-to-Reorder Tasks

Manually prioritize tasks by dragging them into your preferred order.

### How to Use

1. Hover over any task to reveal the drag handle (⋮⋮) on the left
2. Click and hold the drag handle
3. Drag the task to a new position
4. Release to drop
5. The new order is automatically saved

### Features

- Visual drag handle appears on hover
- Drop zones highlight during drag
- Order persists across sessions
- Maintains order when filtering/searching
- Works with all other features

### Notes

- Drag is disabled when bulk mode is active
- Order is preserved even when tasks are filtered out of view
- New tasks are added to the end by default

---

## Bulk Actions (Multi-Select)

Process multiple tasks at once with bulk operations.

### Entering Bulk Mode

**Method 1:** Click the "Bulk Mode" button in the task list header

**Method 2:** Press `Ctrl+B` (keyboard shortcut)

### Selecting Tasks

Once in bulk mode:

**Click to select:** Click on any task's checkbox to toggle selection

**Range selection:** 
1. Select first task
2. Hold `Shift` and click another task
3. All tasks between are selected

**Select all:** Click "Select all" or press `Ctrl+A`

**Clear selection:** Click "Clear" button

### Available Bulk Actions

When tasks are selected, a bulk actions bar appears with these options:

**✓ Complete** - Mark all selected tasks as done

**Priority** - Set priority level for all selected tasks:
- ⏫ Highest
- 🔴 High
- 🟡 Medium
- 🔵 Low
- ⏬ Lowest

**🗑️ Delete** - Delete all selected tasks (with confirmation)

### Exiting Bulk Mode

- Click "Cancel" button
- Press `Esc`
- Click "Exit Bulk" toggle button

All selections are cleared when exiting bulk mode.

---

## Custom Keyboard Shortcuts

Personalize your workflow with customizable keyboard shortcuts.

### Default Shortcuts

See [Keyboard Shortcuts Reference](keyboard-shortcuts-reference.md) for a complete list.

### Customizing Shortcuts

1. Open Settings
2. Navigate to "Keyboard Shortcuts"
3. Find the action you want to customize
4. Click "Record" next to the action
5. Press your desired key combination
6. The shortcut is automatically saved

### Recording a Shortcut

1. Click "Record" button
2. Press your key combination (e.g., `Ctrl+Shift+N`)
3. Release all keys
4. If valid, the shortcut is saved
5. If there's a conflict, you'll see an error message

### Conflict Detection

- The system prevents duplicate shortcuts
- If you try to assign a shortcut that's already in use, you'll see: "Conflicts with [Action Name]"
- Choose a different combination or reassign the conflicting shortcut first

### Resetting Shortcuts

**Reset one shortcut:** Click "Reset" next to the action

**Reset all shortcuts:** Click "Reset All" button (requires confirmation)

### Tips

- Shortcuts don't fire when typing in input fields
- Use modifier keys (Ctrl, Shift, Alt) for most shortcuts
- Single-key shortcuts work best for frequently-used actions
- Custom shortcuts persist across sessions

---

## Best Practices

### Search & Filter Workflow

1. Use filters for broad categorization (e.g., "Overdue")
2. Refine with search for specific tasks
3. Clear filters when done to see all tasks

### Drag-to-Reorder Workflow

1. Filter to a specific view (e.g., "Today")
2. Reorder tasks by priority
3. Tackle tasks from top to bottom

### Bulk Operations Workflow

1. Filter to target tasks (e.g., "Completed")
2. Enter bulk mode
3. Select tasks to process
4. Apply bulk action
5. Exit bulk mode

### Keyboard Shortcuts Workflow

1. Start with default shortcuts
2. Learn the most-used shortcuts first
3. Customize conflicting or awkward shortcuts
4. Create shortcuts for your most frequent actions

---

## Performance Notes

- Search is optimized for <50ms on 1000+ tasks
- Drag animations run at 60fps
- Bulk operations process ~200ms per task
- All features work smoothly together

---

## Accessibility

All features are fully keyboard accessible:

- **Search:** Navigate with Tab, clear with Esc
- **Filters:** Tab through chips, activate with Enter or Space
- **Drag:** Also supports native drag-and-drop with assistive devices
- **Bulk mode:** All checkboxes are keyboard accessible
- **Shortcuts:** Fully customizable for any workflow

---

## Troubleshooting

**Search not working?**
- Check that Fuse.js loaded properly
- Falls back to simple string matching if library fails

**Drag not working?**
- Make sure bulk mode is not active
- Check that you're grabbing the drag handle (⋮⋮)

**Bulk actions not appearing?**
- Enter bulk mode first (Ctrl+B or toggle button)
- Select at least one task

**Keyboard shortcut not firing?**
- Check for conflicts in Settings → Keyboard Shortcuts
- Make sure you're not typing in an input field
- Verify the shortcut is enabled

---

## Updates & Changes

### Version History

**Phase 4 (Current)**
- Added Quick Search & Smart Filters
- Added Drag-to-Reorder Tasks
- Added Bulk Actions
- Added Custom Keyboard Shortcuts

For detailed release notes, see the main CHANGELOG.md
