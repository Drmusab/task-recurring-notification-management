# Auto-Creation for Inline Tasks

## Overview

The Auto-Creation feature (Phase 3) allows you to automatically create tasks from inline markdown checklists without manually running a command. As you type checklist items in your notes, the plugin can automatically parse and create tasks in the background.

## Features

### 🎯 Automatic Task Creation

Type a checklist with metadata and press Enter or blur the field - the task is created automatically:

```markdown
- [ ] Buy groceries 📅 tomorrow #home
<PRESS ENTER>
✅ Task created automatically!
```

### ⚙️ Flexible Configuration

Control when auto-creation happens:
- **Create on Enter**: Tasks created when you press Enter after typing
- **Create on Blur**: Tasks created when you click away from the checklist
- **Both**: Enable both modes for maximum convenience
- **Neither**: Disable auto-creation (use manual command only)

### 🛡️ Safety Features

- **Duplicate Prevention**: Won't create multiple tasks for the same checklist
- **Parse Error Handling**: Invalid syntax shows helpful errors without corrupting text
- **Debouncing**: Prevents performance issues from rapid typing (500ms delay on blur)
- **Graceful Degradation**: Failures are logged but don't break your workflow

### 💡 Visual Feedback

- **Error Hints**: Red border and notification when parsing fails
- **Managed Tasks**: Optional visual indicator for checklists that have linked tasks
- **Non-Intrusive**: Errors are temporary and don't modify your content

## Settings

Access auto-creation settings from the plugin settings panel under the **Auto-Creation** tab.

### Enable Inline Creation
**Default**: `true`

Master toggle for the entire auto-creation feature. When disabled, all auto-creation is turned off.

### Auto-Creation Triggers

#### Create on Enter
**Default**: `false`

When enabled, pressing Enter after typing a checklist automatically creates the task.

**Example**:
```markdown
- [ ] Review PR #123 📅 today 🔼
<ENTER> ← Task created immediately
```

#### Create on Blur
**Default**: `false`

When enabled, clicking away from a checklist line automatically creates the task after a 500ms delay.

**Example**:
```markdown
- [ ] Update documentation 📅 next week
<CLICK ELSEWHERE> ← Task created after 500ms
```

### Normalization

#### Normalize on Save
**Default**: `true`

Automatically reformats the checklist text to a standard format after task creation.

**Before**:
```markdown
- [ ]  Task with   extra   spaces  📅  tomorrow
```

**After normalization**:
```markdown
- [ ] Task with extra spaces 📅 2026-01-24
```

### Parsing Mode

#### Strict Parsing
**Default**: `false`

When enabled, tasks with any parsing errors are rejected completely. When disabled (recommended), tasks with minor errors can still be created with default values.

⚠️ **Warning**: Strict mode can be frustrating as it rejects tasks with any syntax errors. Only enable if you want very strict validation.

### Visual Indicators

#### Show Error Hints
**Default**: `true`

Display inline error messages and visual indicators when task parsing fails.

**Example**:
```markdown
- [ ] Task 📅 invaliddate ⚠️ ← Error indicator shown
```

#### Highlight Managed Tasks
**Default**: `true`

Add a visual indicator (subtle blue border) to checklists that have linked tasks.

## Usage Examples

### Basic Auto-Creation

1. Enable "Create on Enter" in settings
2. Type a checklist in your note:
   ```markdown
   - [ ] Call dentist 📅 tomorrow
   ```
3. Press Enter
4. Task is automatically created and linked to the checklist

### Blur Mode for Batch Entry

1. Enable "Create on Blur" in settings
2. Quickly type multiple checklists:
   ```markdown
   - [ ] Task 1 📅 today
   - [ ] Task 2 📅 tomorrow  
   - [ ] Task 3 📅 next week
   ```
3. Click elsewhere in your note
4. All tasks are created after a short delay

### Error Handling

If you type invalid syntax:

```markdown
- [ ] Task with bad date 📅 notadate
```

You'll see:
- ⚠️ Red border on the block (temporary)
- 🔔 Notification: "Invalid task syntax: Invalid due date: ..."
- 📝 Original text is preserved (never destroyed)

### Duplicate Prevention

If you try to create the same task twice:

```markdown
- [ ] Same task 📅 today
<ENTER> ← Task created

- [ ] Same task 📅 today
<ENTER> ← Skipped (task already exists for this block)
```

## Performance

Auto-creation is optimized for minimal performance impact:

- **Target latency**: < 50ms for task creation
- **Debouncing**: 500ms delay prevents excessive operations during rapid typing
- **No UI blocking**: All operations are asynchronous
- **Efficient duplicate checks**: O(1) lookup by block ID

## Troubleshooting

### Tasks aren't being created automatically

**Check**:
1. Is "Enable Inline Creation" turned on?
2. Is "Create on Enter" or "Create on Blur" enabled?
3. Is your text a valid checklist (`- [ ]` format)?
4. Check the console logs for errors

### Getting parse errors

**Solutions**:
1. Check your date format (use ISO `YYYY-MM-DD` or natural language like "tomorrow")
2. Verify recurrence syntax (e.g., `🔁 every week`)
3. Review [Inline Task Syntax Guide](./InlineTaskSyntax.md)
4. Disable "Strict Parsing" to be more forgiving

### Performance issues

**Solutions**:
1. Ensure only blur or enter mode is enabled (not both)
2. Check that you don't have thousands of checklists in one note
3. Disable "Highlight Managed Tasks" if you have many tasks

### Tasks created multiple times

This shouldn't happen due to duplicate detection. If it does:
1. Check console logs for errors
2. Report as a bug with reproduction steps

## Best Practices

### For Quick Entry
- Enable **Create on Enter**
- Keep **Normalize on Save** enabled
- Use natural language dates

### For Batch Entry
- Enable **Create on Blur**
- Type multiple checklists quickly
- Click elsewhere to trigger batch creation

### For Precision
- Enable **Strict Parsing**
- Use ISO date formats
- Review syntax before pressing Enter

### For Safety
- Keep **Show Error Hints** enabled
- Leave **Strict Parsing** disabled
- Always review created tasks in the dashboard

## Integration with Other Features

### Manual Command
Auto-creation doesn't replace the manual "Create Task from Block" command. You can still use the command to:
- Create tasks with more control
- Edit existing tasks
- Open the task editor pre-filled with block data

### Task Editor
After auto-creation, you can:
- Edit tasks in the dashboard
- Add additional fields not supported in inline syntax
- Modify or delete linked tasks

### Normalization
Auto-created tasks can optionally normalize the block text to:
- Standardize date formats
- Clean up whitespace
- Ensure consistent emoji placement

## Technical Details

For developers and advanced users:

### Event Flow
1. User types checklist and triggers event (Enter/Blur)
2. Event handler checks if auto-creation is enabled
3. Block content is extracted and validated
4. Duplicate check via `TaskRepository.getTaskByBlockId()`
5. Inline parser processes the text
6. Task object is created and saved
7. Optional normalization updates the block
8. Visual indicators are applied

### Debouncing
- Blur events are debounced with 500ms delay
- Enter events are NOT debounced (immediate)
- Pending operations are cancelled if user continues typing
- All timeouts are cleaned up on plugin unload

### Error Handling
- Parse errors show notifications but don't modify content
- Network/storage errors are logged and rolled back
- Block text is NEVER destroyed, even on errors

## Related Documentation

- [Inline Task Syntax](./InlineTaskSyntax.md) - Complete syntax reference
- [Natural Language Dates](./NATURAL_LANGUAGE_DATES.md) - Date parsing guide
- [Settings Guide](./settings-guide.md) - All plugin settings explained

## Feedback

This feature is part of Phase 3 implementation. If you encounter issues or have suggestions:

1. Check the troubleshooting section above
2. Review the console logs for errors
3. Report bugs with reproduction steps
4. Share feature requests in the plugin repository
