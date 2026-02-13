# Keyboard Shortcuts Reference

Complete reference of all keyboard shortcuts in the recurring task management dashboard.

## Navigation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↓` | Next Task | Move selection to next task in list |
| `↑` | Previous Task | Move selection to previous task in list |
| `Enter` | Open Task | Open selected task for editing |
| `Esc` | Close Editor | Close task editor and clear selection |

## Editing Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+N` | New Task | Create a new task |
| `Ctrl+Enter` | Complete Task | Mark current task as completed |
| `Delete` | Delete Task | Delete the selected task |

## Bulk Operation Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+B` | Toggle Bulk Mode | Enter or exit bulk selection mode |
| `Ctrl+A` | Select All Tasks | Select all visible tasks (in bulk mode) |

## Global Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+K` | Focus Search | Jump to search bar |
| `?` | Show Keyboard Help | Display keyboard shortcuts help |

---

## Customizing Shortcuts

All shortcuts can be customized in **Settings → Keyboard Shortcuts**.

### How to Customize

1. Click "Record" next to any action
2. Press your desired key combination
3. Release to save (or Esc to cancel)
4. Conflicts are detected automatically

### Modifier Keys

- `Ctrl` - Control key
- `Shift` - Shift key
- `Alt` - Alt key
- `Cmd` / `Meta` - Command key (Mac) / Windows key

### Combination Guidelines

**Good combinations:**
- `Ctrl+Letter` - Main shortcuts
- `Ctrl+Shift+Letter` - Secondary shortcuts
- `Alt+Letter` - Alternative shortcuts
- Single letters (like `?`) - Quick actions

**Avoid:**
- Browser shortcuts (`Ctrl+W`, `Ctrl+T`, etc.)
- System shortcuts (`Alt+Tab`, `Cmd+Q`, etc.)
- 1 shortcuts (check your 1 settings)

---

## Shortcut Categories

### Navigation (4 shortcuts)
Shortcuts for moving through the task list and opening tasks.

### Editing (3 shortcuts)
Shortcuts for creating, completing, and deleting tasks.

### Bulk Operations (2 shortcuts)
Shortcuts for working with multiple tasks at once.

### Global (2 shortcuts)
Shortcuts that work anywhere in the dashboard.

---

## Context-Aware Behavior

### When Search is Focused
- Keyboard shortcuts are **disabled**
- Type normally to search
- `Esc` clears search

### When Task Editor is Open
- Keyboard shortcuts are **disabled** in input fields
- Shortcuts work outside of input fields
- `Esc` closes the editor

### When Bulk Mode is Active
- Navigation shortcuts still work
- `Ctrl+A` selects all visible tasks
- `Esc` exits bulk mode

### When Typing in Input Fields
- All keyboard shortcuts are **automatically disabled**
- Prevents accidental actions while entering data

---

## Platform Differences

### Windows/Linux
- Use `Ctrl` for all Ctrl shortcuts
- `Meta` key is rarely used

### macOS
- `Ctrl` shortcuts work as expected
- `Cmd` (⌘) can be used instead of `Ctrl` for some shortcuts
- System automatically maps appropriate modifier

---

## Advanced Tips

### Workflow Shortcuts

**Quick Task Creation:**
1. `Ctrl+N` - Create new task
2. Type task details
3. `Enter` - Save and close

**Bulk Complete:**
1. `Ctrl+B` - Enter bulk mode
2. Click tasks to select
3. Click "Complete" button
4. `Esc` - Exit bulk mode

**Search and Select:**
1. `Ctrl+K` - Focus search
2. Type search query
3. `Esc` - Return to tasks
4. `↓`/`↑` - Navigate results
5. `Enter` - Open selected task

### Custom Workflow Examples

**Power User Setup:**
- `Ctrl+N` - New task
- `Ctrl+F` - Focus search (customize from `Ctrl+K`)
- `Ctrl+D` - Delete task (customize from `Delete`)
- `Ctrl+E` - Toggle bulk mode (customize from `Ctrl+B`)

**Mac User Setup:**
- `Cmd+N` - New task
- `Cmd+K` - Focus search
- `Cmd+Enter` - Complete task
- `Cmd+B` - Toggle bulk mode

---

## Conflicts to Avoid

### Browser Conflicts
- `Ctrl+W` - Close tab
- `Ctrl+T` - New tab
- `Ctrl+R` - Reload page
- `Ctrl+F` - Browser find (use `Ctrl+K` for app search instead)

### 1 Conflicts
Check your 1 hotkey settings to avoid conflicts with:
- Note navigation shortcuts
- Command palette (`Ctrl+P`)
- Quick switcher (`Ctrl+O`)

### System Conflicts
- `Alt+Tab` - Switch windows
- `Cmd+Q` - Quit app (Mac)
- `Alt+F4` - Close window (Windows)

---

## Accessibility Features

### Screen Readers
- All shortcuts have descriptive aria-labels
- Action announcements on shortcut execution
- Keyboard focus clearly visible

### Alternative Input
- Shortcuts work with alternative keyboards
- Compatible with voice control software
- Can be remapped for special keyboards

### Visual Indicators
- Active shortcuts show in tooltips
- Shortcut hints in menu items
- Recording state clearly visible

---

## Reset to Defaults

If shortcuts become unusable:

1. Open Settings → Keyboard Shortcuts
2. Click "Reset All" button
3. Confirm to restore all default shortcuts

You can also reset individual shortcuts using the "Reset" button next to each action.

---

## Quick Reference Card

Print or save this for quick access:

```
NAVIGATION          EDITING             BULK
↓     Next Task     Ctrl+N   New Task   Ctrl+B  Bulk Mode
↑     Prev Task     Ctrl+⏎   Complete   Ctrl+A  Select All
Enter Open Task     Del      Delete
Esc   Close

GLOBAL
Ctrl+K  Search
?       Help
```

---

## Changelog

### Phase 4
- Initial keyboard shortcuts implementation
- Added customizable shortcuts
- Added shortcut editor UI
- Added conflict detection

For detailed updates, see the main CHANGELOG.md
