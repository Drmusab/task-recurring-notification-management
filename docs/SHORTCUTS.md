# Keyboard Shortcuts

This document describes all keyboard shortcuts available in the Recurring Task Management plugin.

## Task Editor Modal Access Keys

Access keys allow you to quickly navigate to form fields using keyboard shortcuts. The shortcut key varies by platform:

- **Windows/Linux**: `Alt + letter`
- **Mac**: `Ctrl + Option + letter`

### Available Access Keys

When the Task Editor Modal is open, you can use these shortcuts to jump to specific fields:

| Access Key | Field | Description |
|------------|-------|-------------|
| `T` | Task Description | The main task name/description field |
| `N` | Notes | Additional details about the task |
| `P` | Priority | Task priority selector |
| `U` | Status | Task status selector |
| `D` | Due Date | When the task is due |
| `S` | Scheduled Date | When you plan to start working |
| `A` | Start Date | Earliest date the task can begin |
| `R` | Recurrence | Recurrence pattern for the task |

### How to Use Access Keys

1. **Open the Task Editor Modal** (create or edit a task)
2. **Press the access key combination** for the field you want to jump to
   - Windows/Linux: Hold `Alt` and press the letter
   - Mac: Hold `Ctrl + Option` and press the letter
3. **The cursor will jump to that field** and you can start typing

### Visual Indicators

In the Task Editor Modal, access keys are indicated by underlined letters in the field labels:

- **<u>T</u>ask Description** - Press `Alt+T` (Windows/Linux) or `Ctrl+Option+T` (Mac)
- **<u>D</u>ue Date** - Press `Alt+D` (Windows/Linux) or `Ctrl+Option+D` (Mac)
- **<u>P</u>riority** - Press `Alt+P` (Windows/Linux) or `Ctrl+Option+P` (Mac)

### Examples

**Quick Task Creation Flow:**
1. Open task editor: Click "New Task" button
2. Jump to description: `Alt+T` (Windows) or `Ctrl+Option+T` (Mac)
3. Type task name
4. Jump to due date: `Alt+D`
5. Select date
6. Jump to priority: `Alt+P`
7. Select priority
8. Save: `Ctrl+Enter` or `Cmd+Enter`

**Quick Edit Due Date:**
1. Open task editor: Click edit on a task
2. Jump to due date: `Alt+D` (Windows) or `Ctrl+Option+D` (Mac)
3. Update date
4. Save: `Ctrl+Enter` or `Cmd+Enter`

## General Shortcuts

### Task Editor Modal

| Shortcut | Action |
|----------|--------|
| `Ctrl+Enter` (Windows/Linux)<br>`Cmd+Enter` (Mac) | Save task and close modal |
| `Escape` | Close modal without saving |

### Date Input Fields

When focused on a date input field with natural language support:

| Shortcut | Action |
|----------|--------|
| `Ctrl+T` or `Cmd+T` | Insert "today" |
| `Ctrl+M` or `Cmd+M` | Insert "tomorrow" |
| `Ctrl+W` or `Cmd+W` | Insert "next week" |
| `Escape` | Clear the input |

### Navigation

| Shortcut | Action |
|----------|--------|
| `Tab` | Move to next field |
| `Shift+Tab` | Move to previous field |
| `Arrow Up/Down` | Navigate through dropdowns and suggestions |
| `Enter` | Select current suggestion or option |

## Accessibility Notes

### Disabling Access Keys

If access keys conflict with your screen reader or other accessibility tools, you can disable them:

1. Open plugin settings
2. Navigate to "Keyboard Navigation" section
3. Toggle "Enable Access Keys" to off

**Note:** This feature is planned for a future update.

### Screen Reader Support

The Task Editor Modal includes ARIA labels and proper semantic HTML for screen reader compatibility:
- Form fields are properly labeled
- Error messages are announced
- Modal dialogs use appropriate ARIA roles
- Focus management follows accessibility best practices

## Platform-Specific Behavior

### Windows/Linux
- Access keys use `Alt + letter`
- Some browsers may require `Alt + Shift + letter`
- The access key is activated immediately on key press

### Mac
- Access keys use `Ctrl + Option + letter`
- Safari may have different behavior depending on settings
- Check System Preferences > Keyboard > Shortcuts if access keys don't work

### Mobile Devices
- Access keys are not available on touch devices
- Use touch/tap navigation instead
- Consider using a Bluetooth keyboard for shortcut support

## Troubleshooting

### Access Keys Not Working

1. **Check your browser**: Some browsers handle access keys differently
   - Firefox: `Alt + Shift + letter` (Windows/Linux)
   - Chrome: `Alt + letter` (Windows/Linux)
   - Safari: `Ctrl + Option + letter` (Mac)

2. **Check for conflicts**: Other browser extensions or system shortcuts may interfere
   - Try disabling other extensions temporarily
   - Check system keyboard shortcuts in your OS settings

3. **Update the plugin**: Ensure you have the latest version

4. **Platform-specific issues**:
   - Windows: Check if Alt key is not stuck or disabled
   - Mac: Verify Ctrl and Option keys are working
   - Linux: Some desktop environments may override Alt shortcuts

### Visual Indicators Not Showing

If underlined letters are not visible in labels:
1. Check browser zoom level (100% is recommended)
2. Ensure CSS is loading properly
3. Check browser console for styling errors

## Tips for Efficient Use

1. **Learn the most common shortcuts**: Focus on the fields you use most (T, D, P)
2. **Use Tab for sequential navigation**: Access keys are best for jumping to specific fields
3. **Combine with date shortcuts**: Use `Alt+D` then `Ctrl+T` to quickly set due date to today
4. **Save time on recurring tasks**: `Alt+R` to quickly set recurrence pattern
5. **Chain shortcuts**: `Alt+T` → type → `Tab` → `Tab` → `Alt+D` for quick flow

## Future Enhancements

Planned keyboard shortcuts for future releases:
- Global shortcuts for quick task creation from anywhere
- Command palette integration
- Vim-style navigation modes
- Customizable keyboard shortcuts
- Quick actions (complete, postpone, delete) via keyboard

## Feedback

If you have suggestions for additional shortcuts or improvements to the current system, please open an issue on GitHub or contact the plugin maintainer.
