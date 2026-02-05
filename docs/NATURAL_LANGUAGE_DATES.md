# Natural Language Date Parsing

This document describes the natural language date parsing feature that allows users to quickly enter dates using everyday language instead of manual date pickers.

## Overview

The DateInput component supports comprehensive natural language date parsing powered by [chrono-node](https://github.com/wanasit/chrono), allowing users to type dates naturally like "tomorrow at 3pm" or "next Friday" instead of clicking through date pickers.

## Supported Formats

### Relative Dates

Express dates relative to today:

- **Today**: `today`, `now`
- **Tomorrow**: `tomorrow`, `tmr`
- **Yesterday**: `yesterday`
- **Days offset**: `in 2 days`, `in 1 week`, `3 days ago`
- **Weeks offset**: `next week`, `in 2 weeks`, `last week`
- **Months offset**: `next month`, `in 3 months`, `last month`

**Examples:**
```
tomorrow
in 3 days
next week
2 weeks ago
```

### Named Days

Reference specific days of the week:

- **This week**: `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`
- **Next week**: `next Monday`, `next Friday`
- **Last week**: `last Tuesday`, `last Sunday`

**Examples:**
```
Friday
next Monday
last Wednesday
```

**Behavior**: When you type just a day name (e.g., "Friday"), it refers to the next occurrence of that day (including today if today is that day).

### Specific Dates

Enter exact dates in various formats:

- **ISO format**: `2024-01-15`, `2024-12-31`
- **US format**: `Jan 15`, `January 20, 2024`
- **UK format**: `15/01/2024`, `31-12-2024`
- **Month names**: `Jan 15`, `March 3rd`, `December 25th`

**Examples:**
```
2024-01-15
Jan 15
January 20, 2024
15/01/2024
March 3rd
```

### Time Expressions

Add specific times to any date:

- **12-hour format**: `9am`, `2:30pm`, `11:45 pm`
- **24-hour format**: `14:00`, `09:30`, `23:59`
- **Casual**: `at 9`, `at noon`, `at midnight`

**Examples:**
```
tomorrow at 3pm
next Friday at 9:00
Jan 15 at 14:30
Monday at 9am
```

**Default time**: If no time is specified, dates default to midnight (00:00).

### Combined Expressions

Mix date and time expressions:

```
tomorrow at 9am
next Friday at 2:30pm
in 3 days at 14:00
Monday at 9:00
Jan 15 at 3pm
```

### Shortcuts

Quick shortcuts for common times:

| Shortcut | Meaning | Example |
|----------|---------|---------|
| `eod` | End of day (today at 5pm) | `eod` → Today at 17:00 |
| `eow` | End of week (Friday at 5pm) | `eow` → Friday at 17:00 |
| `eom` | End of month (last day at 5pm) | `eom` → Jan 31 at 17:00 |

**Examples:**
```
eod     → Today, 5:00 PM
eow     → This Friday, 5:00 PM
eom     → Last day of this month, 5:00 PM
```

## Using the DateInput Component

### Basic Usage

The DateInput component automatically appears in task forms where you need to enter a due date.

1. **Click** in the date field
2. **Type** your date naturally (e.g., "tomorrow at 9am")
3. **Select** from autocomplete suggestions OR press **Enter**
4. The date will be validated and displayed below the input

### Autocomplete Suggestions

As you type, intelligent suggestions appear based on your input:

- **Relative dates**: Today, Tomorrow, In 2 days, In 1 week, etc.
- **Named days**: Monday, Tuesday, Wednesday, etc.
- **Shortcuts**: EOD, EOW, EOM
- **Custom**: Filtered based on what you've typed

**Navigation:**
- `↑` / `↓` - Move through suggestions
- `Enter` - Select highlighted suggestion
- `Esc` - Close suggestions
- `Click` - Select suggestion

### Visual Feedback

The DateInput provides real-time feedback:

- **Green checkmark (✓)**: Valid date successfully parsed
- **Warning icon (⚠)**: Invalid date format
- **Calendar icon (📅)**: Opens fallback date picker
- **Clear button (✕)**: Clears the current input

Below the input, you'll see:
- **Preview**: Formatted date with relative time (e.g., "📅 Fri, Jan 26, 2024 (in 2 days)")

### Fallback Date Picker

If you prefer traditional date picking:

1. Click the **📅 calendar icon**
2. Use the standard HTML date/time picker
3. Selected date will populate the input field

## Keyboard Shortcuts

Speed up date entry with keyboard shortcuts:

| Shortcut | Action | Result |
|----------|--------|--------|
| `Ctrl/Cmd + T` | Insert "today" | Today's date |
| `Ctrl/Cmd + M` | Insert "tomorrow" | Tomorrow's date |
| `Ctrl/Cmd + W` | Insert "next week" | Next week |
| `Tab` | Move to time field | Focus time input (if enabled) |
| `Esc` | Close autocomplete | Dismiss suggestions |
| `Esc` (twice) | Clear input | Clear empty input field |

**Platform note**: Use `Cmd` on macOS, `Ctrl` on Windows/Linux.

## Timezone Behavior

All dates are:
- **Parsed** in your local timezone
- **Stored** in UTC for consistency
- **Displayed** in your local timezone

The system automatically handles:
- Timezone conversions
- Daylight Saving Time (DST) transitions
- International date formats

You don't need to worry about timezones - the system handles everything automatically.

## Validation and Errors

### Valid Inputs

The component accepts:
- Any format described in this document
- Empty input (unless field is required)
- ISO date strings from existing tasks

### Invalid Inputs

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Could not parse date" | Unrecognized format | Try a different format or use suggestions |
| "Due date required" | Empty required field | Enter any valid date |
| Warning icon (⚠) | Ambiguous date | Check preview to ensure correct interpretation |

### Ambiguous Dates

When dates are ambiguous, the system:
- **Defaults to future dates** (not past)
- Shows the interpretation in the preview
- Allows you to adjust if needed

**Example**: If today is Wednesday and you type "Monday", it assumes next Monday (not last Monday).

## Best Practices

### For Quick Entry
- Use shortcuts: `eod`, `tomorrow`, `next week`
- Use autocomplete: Start typing and select from suggestions
- Use keyboard shortcuts: `Ctrl/Cmd + T` for today

### For Precision
- Include exact times: `tomorrow at 9:30am`
- Use ISO format: `2024-01-15T14:30`
- Verify in preview before saving

### For Recurring Tasks
- Set the first occurrence using natural language
- Use the recurrence settings for pattern
- Example: "Monday at 9am" + weekly recurrence = every Monday at 9am

## Examples by Use Case

### Daily Tasks
```
tomorrow at 9am          → Tomorrow, 9:00 AM
eod                      → Today, 5:00 PM
every weekday at 8am     → (use with recurrence settings)
```

### Weekly Tasks
```
next Monday              → Next Monday, 12:00 AM
Friday at 2pm            → This/next Friday, 2:00 PM
eow                      → This Friday, 5:00 PM
```

### Monthly Tasks
```
next month               → Same day next month
eom                      → Last day of this month, 5:00 PM
March 15                 → March 15th
```

### Project Deadlines
```
in 2 weeks               → 14 days from now
Jan 31 at 5pm            → January 31, 5:00 PM
2024-12-25               → December 25, 2024
```

## Technical Details

### Parser Implementation

The date parser uses:
- **Primary**: chrono-node for comprehensive natural language parsing
- **Fallback**: Custom regex patterns for specific formats
- **Shortcuts**: Custom handlers for eod/eow/eom

### Performance

- **Parsing speed**: < 10ms for most inputs
- **Debounce**: 150ms for autocomplete suggestions
- **No blocking**: All parsing is non-blocking

### Browser Compatibility

Tested and supported on:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### Date Not Parsing

1. Check if the format matches supported patterns
2. Try a simpler format (e.g., "tomorrow" instead of complex expression)
3. Use the calendar picker as fallback
4. Check preview to see what was parsed

### Wrong Date Interpretation

1. Be more specific (e.g., "next Monday" vs just "Monday")
2. Use ISO format for exact dates (e.g., "2024-01-15")
3. Check your system timezone settings
4. Verify in the preview before saving

### Autocomplete Not Appearing

1. Ensure you're typing in the field
2. Type at least one character
3. Check that suggestions match your input
4. Try clearing and re-typing

### Keyboard Shortcuts Not Working

1. Ensure the input field has focus
2. Use correct modifier key (Cmd on Mac, Ctrl on Windows/Linux)
3. Check if browser shortcuts are conflicting
4. Try clicking in the field first

## FAQ

**Q: What happens if I type an invalid date?**  
A: The input will show a warning icon (⚠) and won't save until you correct it.

**Q: Can I still use the old date picker?**  
A: Yes! Click the 📅 calendar icon to open the traditional date/time picker.

**Q: Do I need to specify a time?**  
A: No. If omitted, dates default to midnight (00:00). You can add time later if needed.

**Q: What if I want a date in the past?**  
A: Use specific dates ("Jan 1") or explicit past references ("3 days ago", "last Monday").

**Q: How do I clear a date?**  
A: Click the ✕ clear button, or press Esc twice when the field is empty.

**Q: Can I edit a date after selecting it?**  
A: Yes! Click in the field and modify the text. The parser will re-validate.

**Q: Are dates stored in my timezone?**  
A: Dates are stored in UTC but always displayed in your local timezone.

## See Also

- [Recurrence Pattern Guide](./RECURRENCE.md) - For setting up recurring tasks
- [Task Management Guide](./README.md) - General task management features
- [Keyboard Shortcuts](./SHORTCUTS.md) - All available keyboard shortcuts
