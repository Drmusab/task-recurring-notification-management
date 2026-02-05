# Natural Language Parser - Quick Reference

The Enhanced Natural Language Parser allows you to create recurring tasks using intuitive, human-readable patterns.

## Basic Patterns

### Simple Recurrence
- `every day` - Daily recurrence
- `every week` - Weekly recurrence
- `every month` - Monthly recurrence
- `every year` - Yearly recurrence

### With Intervals
- `every 2 days` - Every two days
- `every 3 weeks` - Every three weeks
- `every 6 months` - Every six months

## Advanced Patterns

### Ordinal Days (Monthly Recurrence)
Create tasks that repeat on specific occurrences of weekdays within a month:

- `every 2nd Tuesday` - Second Tuesday of every month
- `every 1st Monday` - First Monday of every month
- `every 3rd Wednesday` - Third Wednesday of every month
- `every 4th Friday` - Fourth Friday of every month
- `every last Friday of the month` - Last Friday of every month

**Examples:**
- Team meeting: `every 1st Monday`
- Monthly review: `every last Friday of the month`
- Quarterly check-in: `every 3rd Thursday`

### Compound Frequencies (Multiple Weekdays)
Set up tasks that repeat on multiple days of the week:

- `every 2 weeks on Monday and Wednesday` - Bi-weekly on Mon/Wed
- `every week on Monday and Tuesday and Friday` - Weekly on Mon/Tue/Fri
- `every 3 weeks on Friday` - Every three weeks on Friday

**Examples:**
- Gym routine: `every week on Monday and Wednesday and Friday`
- Team standup: `every week on Monday and Tuesday and Wednesday and Thursday and Friday`
- Client calls: `every 2 weeks on Tuesday`

### Relative Dates (One-time Tasks)
Create tasks with relative due dates:

- `in 3 days` - Due in 3 days from now
- `in 2 weeks` - Due in 2 weeks from now
- `in 1 month` - Due in 1 month from now
- `next Monday` - Due next Monday
- `end of month` - Due on the last day of the month

**Note:** These patterns create one-time tasks, not recurring tasks.

### Month-Aware Patterns
Set up monthly tasks on specific days:

- `every 15th` - 15th of every month
- `every 1st` - 1st of every month
- `every 31st` - 31st of every month (skips months without 31 days)
- `on the 1st and 15th` - 1st and 15th of every month (multiple days)

**Examples:**
- Bill payment: `every 1st`
- Mid-month review: `every 15th`
- Bi-monthly tasks: `on the 1st and 15th`

## Confidence Scores

The parser returns a confidence score (0-1) indicating how well it understood your input:

- **0.95+**: Ordinal patterns ("every 2nd Tuesday")
- **0.90+**: Compound frequencies ("every 2 weeks on Monday and Wednesday")
- **0.85+**: Month-aware patterns ("every 15th"), relative dates
- **0.70+**: Basic patterns handled by fallback parser

Higher confidence means the parser is more certain about the interpretation.

## Tips for Best Results

1. **Use lowercase**: `every monday` works better than `EVERY MONDAY`
2. **Be specific**: Instead of "every other week", use "every 2 weeks"
3. **Check confidence**: Low confidence scores may indicate ambiguous input
4. **Test patterns**: Try your pattern and verify it creates the expected schedule

## Common Patterns

### Weekly Tasks
```
every Monday
every week on Tuesday
every 2 weeks on Friday
every week on Monday and Wednesday
```

### Monthly Tasks
```
every 15th
every 1st Monday
every last Friday of the month
on the 1st and 15th
```

### Periodic Reviews
```
every 3rd Thursday  (monthly review)
every 2 weeks on Monday  (bi-weekly check-in)
every 1st and 15th  (bi-monthly tasks)
```

## Limitations

1. The parser doesn't support:
   - Time-specific recurrence (e.g., "every Monday at 2pm")
   - Year-specific patterns (e.g., "every January 15th")
   - Complex conditions (e.g., "every Monday except holidays")

2. For these cases, use the standard recurrence editor or RRule format.

## Examples by Use Case

### Team Management
- `every 1st Monday` - Monthly team meeting
- `every week on Monday and Wednesday and Friday` - Regular check-ins
- `every 2 weeks on Tuesday` - Sprint planning

### Personal Tasks
- `every 15th` - Bill payments
- `every last Friday of the month` - Monthly budget review
- `every week on Monday` - Weekly meal prep

### Project Management
- `every 3 weeks on Friday` - Client status reports
- `every 1st and 15th` - Project milestone reviews
- `every 2nd Tuesday` - Stakeholder meetings
