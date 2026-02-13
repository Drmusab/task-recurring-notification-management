# Keyboard Shortcuts Guide

## Overview

This plugin provides comprehensive keyboard shortcuts to enhance your productivity when managing recurring tasks and queries in SiYuan.

## Quick Reference

### Task Management

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Shift+T` | Quick add recurring task | Global / Editor |
| `Ctrl+Enter` | Mark task as done | Task focus |
| `Ctrl+Shift+P` | Postpone task | Task focus |
| `Ctrl+Shift+D` | Quick complete next task | Global |
| `Ctrl+Shift+X` | Toggle task status | Task focus |
| `Ctrl+Shift+E` | Open task editor | Global |
| `Ctrl+Shift+I` | Create/Edit task from block | Editor / Block |
| `Ctrl+Shift+R` | Create recurring task from selection | Editor |

### Query Operations

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Enter` | Execute query | Query Editor |
| `Ctrl+Shift+E` | Explain query | Query Editor |
| `Ctrl+F` | Focus search/query input | Global |
| `Ctrl+S` | Save current query | Query Editor |

### Navigation

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+Shift+O` | Open recurring tasks dock | Global |
| `Ctrl+Alt+C` | Toggle calendar view | Global |
| `Esc` | Close panel/dialog | Global |

### General

| Shortcut | Action | Context |
|----------|--------|---------|
| `Ctrl+R` | Refresh tasks | Global |
| `Shift+?` | Show keyboard shortcuts help | Global |

## Platform-Specific Modifiers

### Windows/Linux
- `Ctrl` - Control key
- `Shift` - Shift key
- `Alt` - Alt key

### macOS
- `⌘` (Cmd) - Command key (replaces Ctrl in most shortcuts)
- `⇧` (Shift) - Shift key
- `⌥` (Option) - Option/Alt key

## Detailed Shortcuts

### Task Management Shortcuts

#### Quick Add Task (`Ctrl+Shift+T`)
Opens the quick add dialog with focus on the task title field. This is the fastest way to create a new recurring task.

**Usage:**
1. Press `Ctrl+Shift+T` from anywhere in SiYuan
2. Type your task name
3. Press `Enter` or configure additional fields
4. Press `Ctrl+S` to save

#### Mark Task as Done (`Ctrl+Enter`)
Completes the currently focused task and triggers recurrence if configured.

**Usage:**
1. Focus on a task (click or navigate using keyboard)
2. Press `Ctrl+Enter`
3. Task is marked complete and next occurrence is created

#### Postpone Task (`Ctrl+Shift+P`)
Opens the snooze/postpone selector for the focused task.

**Options:**
- Later today
- Tomorrow
- Next week
- Custom date/time

#### Toggle Task Status (`Ctrl+Shift+X`)
Cycles through available task statuses (Todo → In Progress → Done → Todo).

### Query Operations Shortcuts

#### Execute Query (`Ctrl+Enter`)
Executes the current query in the query editor and displays results.

**Usage:**
1. Type your query in the query editor
2. Press `Ctrl+Enter` to execute
3. Results appear below the query

**Example queries:**
```
where status = todo and priority = high
where due >= today and due <= today + 7d
where tag includes #work and done = false
```

#### Explain Query (`Ctrl+Shift+E`)
Shows a detailed explanation of the current query, including:
- Query structure visualization
- Filter breakdown
- Performance impact
- Suggested optimizations

**Usage:**
1. Type or select a query
2. Press `Ctrl+Shift+E`
3. Review the explanation panel

#### Focus Search (`Ctrl+F`)
Quickly jump to the search/query input field from anywhere.

#### Save Query (`Ctrl+S`)
Saves the current query to your saved queries library for reuse.

**Usage:**
1. Create and test your query
2. Press `Ctrl+S`
3. Enter a name and optional description
4. Query is saved to your library

### Navigation Shortcuts

#### Open Recurring Tasks Dock (`Ctrl+Shift+O`)
Opens or focuses the recurring tasks dashboard panel.

#### Toggle Calendar View (`Ctrl+Alt+C`)
Switches between calendar and list views for your tasks.

#### Close Panel (`Esc`)
Closes the currently open panel, dialog, or modal. Can be pressed multiple times to close nested panels.

### General Shortcuts

#### Refresh Tasks (`Ctrl+R`)
Manually refreshes all tasks from storage. Useful if you've made changes in another instance or want to ensure you have the latest data.

#### Show Keyboard Shortcuts Help (`Shift+?`)
Displays this comprehensive list of keyboard shortcuts in an interactive dialog.

**Features:**
- Organized by category
- Searchable
- Shows current key bindings
- Platform-aware (displays correct modifiers for your OS)

## Customizing Shortcuts

> **Note:** Custom shortcut configuration is planned for a future release.

Currently, shortcuts use the default key bindings shown above. Future versions will include:
- User-configurable key bindings
- Conflict detection
- Import/export of shortcut configurations
- Per-workspace shortcut profiles

## Tips for Effective Use

### 1. Learn Progressive Shortcuts
Start with these essential shortcuts and add more as you become comfortable:
1. `Ctrl+Shift+T` - Quick add task
2. `Ctrl+Enter` - Complete task
3. `Ctrl+F` - Focus search
4. `Shift+?` - Show help

### 2. Context Awareness
Some shortcuts work differently depending on context:
- `Ctrl+Enter` marks task as done when focused on a task
- `Ctrl+Enter` executes query when in the query editor

### 3. Modifier Combinations
Shortcuts use standard modifier patterns:
- `Ctrl+Key` - Basic actions
- `Ctrl+Shift+Key` - Advanced/variant actions
- `Ctrl+Alt+Key` - View/navigation toggles

### 4. Escape to Cancel
Pressing `Esc` will:
- Close dialogs and panels
- Cancel ongoing operations
- Return focus to the main view

## Accessibility

All keyboard shortcuts are designed with accessibility in mind:
- Full keyboard navigation support
- Screen reader compatible
- No mouse required for any operation
- Visual focus indicators
- ARIA labels for interactive elements

## Troubleshooting

### Shortcut Not Working

**Check these common issues:**

1. **Conflicting shortcuts**: Some shortcuts may conflict with SiYuan's built-in shortcuts or other plugins
2. **Context mismatch**: Ensure you're in the right context (e.g., query editor, task focus)
3. **Input field focus**: Some shortcuts are disabled when typing in text fields (except `Esc`)

### Platform Differences

**macOS users:** Replace `Ctrl` with `⌘` (Command) in most shortcuts.

**Linux users:** Some window managers may intercept certain key combinations. Check your system settings if a shortcut doesn't work.

## Feedback

Found a useful shortcut we're missing? Have suggestions for improving the keyboard experience? Please submit feedback through:
- GitHub Issues
- SiYuan forum discussion
- Plugin settings feedback form

---

**Last Updated:** Phase 2 - Week 4  
**Version:** 1.0.0  
**Maintainer:** Recurring Task Management Plugin Team
