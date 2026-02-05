# Natural Language Recurrence Guide

## Overview

The Natural Language Recurrence feature allows you to create recurring tasks using simple, human-readable text instead of complex configuration forms. This guide explains the syntax, capabilities, and best practices for using natural language recurrence patterns.

## Quick Start

Instead of manually configuring recurrence rules with dropdowns and date pickers, you can now type natural language patterns like:

- `every day`
- `every 2 weeks on Monday and Wednesday`
- `every month on the 15th`
- `every week when done`

The system automatically converts these into proper recurrence rules using the industry-standard RRule library.

## Syntax Reference

### Daily Recurrence

```
every day
every 2 days
every 3 days
```

**Examples:**
- `every day` → repeats daily
- `every 2 days` → repeats every other day
- `every 5 days` → repeats every 5 days

### Weekly Recurrence

```
every week
every 2 weeks
every week on Monday
every week on Monday and Wednesday
every 2 weeks on Friday
every weekday
```

**Examples:**
- `every week` → repeats weekly on the same day
- `every 2 weeks` → repeats every other week
- `every Monday` → repeats every Monday
- `every week on Monday and Wednesday` → repeats on Mondays and Wednesdays
- `every weekday` → repeats Monday through Friday

**Weekday Names:**
- `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`
- Can combine multiple days with `and`

### Monthly Recurrence

```
every month
every 2 months
every month on the 15th
every 3 months on the 1st
every month on the last day
```

**Examples:**
- `every month` → repeats monthly on the same day
- `every month on the 15th` → repeats on the 15th of each month
- `every 2 months on the 1st` → repeats every other month on the 1st
- `every 3 months` → repeats quarterly

### Yearly Recurrence

```
every year
every 2 years
every year on January 1st
every year on March 15th
```

**Examples:**
- `every year` → repeats annually on the same date
- `every year on January 1st` → repeats every New Year's Day
- `every year on March 15th` → repeats every March 15th

## "When Done" Suffix

Adding `when done` to any pattern changes when the next occurrence is calculated:

- **Without "when done"**: Next occurrence is calculated from the current due date
- **With "when done"**: Next occurrence is calculated from the completion date

**Examples:**
```
every week when done
every 2 days when done
every month on the 1st when done
```

**Use Cases:**
- Flexible recurring tasks where the exact date isn't critical
- Tasks that should recur based on when you actually complete them
- Habits you want to maintain with a certain frequency but not fixed dates

**Example:**
- Task: "Water plants"
- Pattern: `every 3 days when done`
- Due: January 1st
- You complete it on January 2nd → Next due: January 5th (3 days after completion)
- If it was without "when done", next due would be January 4th (3 days after original due date)

## Time Specification

You can specify a fixed time for recurrence using the time field separately from the natural language pattern. The natural language parser focuses on the frequency pattern, while time is set via the time field.

**Example in task configuration:**
- Recurrence: `every weekday`
- Time: `09:00`
- Result: Task repeats Monday-Friday at 9:00 AM

## Advanced Patterns

### Complex Weekly Patterns

```
every 2 weeks on Monday and Wednesday
every 3 weeks on Friday
```

### Month-End Handling

The system intelligently handles month-end edge cases:

- `every month on the 31st` on a 30-day month → schedules for the 30th
- Next occurrence on a 31-day month → resumes on the 31st
- February handling: automatically adjusts to the 28th/29th

**Example:**
- Pattern: `every month on the 31st`
- January 31st → February 28th → March 31st → April 30th → May 31st

### Timezone Support

Recurrence calculations respect your timezone settings to ensure:
- Consistent local times across DST transitions
- Correct day boundaries for daily recurrence
- Proper handling of international time zones

## Validation and Feedback

The natural language parser provides instant feedback:

### Valid Patterns
✓ Pattern is accepted and converted to a recurrence rule
✓ Visual preview shows next 3 occurrences
✓ No error messages

### Invalid Patterns
✗ Pattern cannot be parsed
✗ Error message explains what went wrong
✗ Suggestions for valid patterns

**Example Error:**
```
Invalid: "every sometimes maybe"
Error: Could not parse recurrence pattern
Suggestion: Try patterns like "every day", "every week", "every month"
```

## Migration from Manual Configuration

If you have existing tasks with manually configured recurrence:

1. **Backward Compatible**: All existing tasks continue to work without changes
2. **Optional Upgrade**: You can convert to natural language by editing the task
3. **No Data Loss**: Original configuration is preserved

**To Convert:**
1. Open task in editor
2. Switch to "Natural Language" mode
3. Type your pattern (e.g., `every week`)
4. Save

The system will:
- Parse your natural language
- Generate the equivalent RRule
- Store both the natural language text and the formal rule
- Use the RRule for precise calculations

## Examples by Use Case

### Personal Tasks
```
Exercise routine:           every 2 days when done
Take vitamins:             every day
Weekly review:             every Sunday
Monthly bills:             every month on the 1st
Annual checkup:            every year on March 15th
```

### Work Tasks
```
Team meeting:              every Monday
Biweekly sprint:           every 2 weeks on Monday
Monthly report:            every month on the last day
Quarterly review:          every 3 months on the 15th
Weekly timesheet:          every Friday
```

### Household Tasks
```
Water plants:              every 3 days when done
Clean kitchen:             every weekday
Grocery shopping:          every week on Saturday
Pay rent:                  every month on the 1st
HVAC filter change:        every 3 months
```

### Habits and Goals
```
Read:                      every day
Gym:                       every Monday and Wednesday
Call family:               every week on Sunday
Write journal:             every day
Practice instrument:       every weekday
```

## Best Practices

### 1. Start Simple
Begin with basic patterns and only add complexity when needed:
- ✓ `every week`
- ✗ `every week on Monday and Tuesday and Wednesday and Thursday and Friday` (use `every weekday` instead)

### 2. Use "When Done" Wisely
Use `when done` for flexible tasks, but avoid it for time-critical tasks:
- ✓ `every 3 days when done` for watering plants
- ✗ `every week when done` for a fixed weekly meeting

### 3. Test Your Pattern
After entering a pattern:
1. Check the preview of next occurrences
2. Verify it matches your intention
3. Complete one instance and check the next scheduled date

### 4. Be Specific When Needed
For monthly tasks, specify the day:
- ✓ `every month on the 15th` (clear and predictable)
- ✗ `every month` (depends on when the task was created)

### 5. Document Complex Patterns
For unusual patterns, add a note in the task description explaining the recurrence logic.

## Technical Details

### RRule Integration

Natural language patterns are converted to RFC 5545 RRule format:
- Industry standard for recurrence rules
- Used by calendar applications worldwide
- Precise and unambiguous
- Supports complex patterns

### Storage

Each frequency object stores:
```typescript
{
  type: "weekly",
  interval: 2,
  weekdays: [0, 2], // Monday and Wednesday
  naturalLanguage: "every 2 weeks on Monday and Wednesday",
  rruleString: "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
}
```

### Performance

- Natural language parsing is fast (<10ms for most patterns)
- Parsed rules are cached
- Recurrence calculation uses optimized algorithms
- No performance impact on existing tasks

## Troubleshooting

### Pattern Not Recognized

**Problem:** Your pattern shows an error

**Solutions:**
1. Check spelling of day names (`Monday`, not `Mondai`)
2. Use supported keywords (`every`, not `each`)
3. Include interval (`every 2 weeks`, not `2 weeks`)
4. Simplify complex patterns

### Unexpected Next Occurrence

**Problem:** Next occurrence date doesn't match expectation

**Check:**
1. Is "when done" suffix included/excluded correctly?
2. Is the current due date what you expect?
3. For monthly: Is it a month-end edge case?
4. For weekly: Are the weekdays correct?

### Suggestions Not Appearing

**Problem:** Autocomplete doesn't show suggestions

**Causes:**
1. Pattern is already complete
2. Typed too many characters
3. Pattern is already valid

**Try:** Delete some characters and wait for suggestions

## Limitations

### Current Limitations

1. **No nth-weekday rules**: Cannot specify "first Monday of the month" (coming in future phase)
2. **No exclusions**: Cannot specify "every day except weekends" directly
3. **Limited complexity**: Very complex patterns may need manual configuration

### Workarounds

For unsupported patterns:
1. Use multiple tasks (e.g., one for weekdays, one for weekends)
2. Use manual configuration mode
3. Request the feature for future updates

## Future Enhancements

Planned improvements:
- Support for "first/last/nth weekday of month" patterns
- Exclusion rules ("except when")
- Time zone in natural language
- More language flexibility
- Smarter suggestions based on history

## Getting Help

If you encounter issues:
1. Check this guide for syntax examples
2. Look at query examples in the documentation
3. Try the manual configuration mode as fallback
4. Report bugs with the exact pattern that failed

## Summary

Natural language recurrence makes creating recurring tasks intuitive and fast:
- Type simple English patterns instead of configuring forms
- Get instant validation and preview
- Backward compatible with existing tasks
- Powered by industry-standard RRule library

Start with basic patterns like `every day` or `every week`, and explore more complex patterns as needed!
