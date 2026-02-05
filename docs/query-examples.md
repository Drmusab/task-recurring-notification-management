# Query Examples & Cookbook

This document provides a collection of useful query patterns and examples for common task management scenarios.

## Table of Contents

1. [Daily Workflow](#daily-workflow)
2. [Weekly Planning](#weekly-planning)
3. [Priority Management](#priority-management)
4. [Project Management](#project-management)
5. [Review & Maintenance](#review--maintenance)
6. [Advanced Patterns](#advanced-patterns)
7. [Troubleshooting](#troubleshooting)

## Daily Workflow

### Today's Tasks
View all tasks due today:
```
not done
due on today
sort by priority reverse
```

### Today's Priority Tasks
Focus on high-priority items due today:
```
not done
due on today
priority above normal
sort by priority reverse
```

### Overdue Tasks
Find what needs immediate attention:
```
not done
due before today
sort by due
```

### Tasks to Start Today
Tasks scheduled to begin today:
```
not done
start on today
sort by priority reverse
```

### Morning Review
Everything requiring attention today:
```
not done
due on or before today
sort by priority reverse
limit 20
```

## Weekly Planning

### This Week's Tasks
All tasks due this week:
```
not done
due on or before next week
group by due
```

### Next Week's Planning
Prepare for upcoming week:
```
not done
due on or after next week
due before next month
group by priority
```

### Weekly Review
Completed tasks this week:
```
done
done on or after last week
sort by done reverse
```

### Week Ahead by Priority
Prioritized view of upcoming week:
```
not done
due on or before next week
sort by priority reverse
group by due
```

## Priority Management

### All High Priority
Quick access to important tasks:
```
not done
priority is high
sort by due
```

### Urgent and Overdue
Critical items needing immediate attention:
```
not done
priority above high
due before today
sort by due
```

### Low Priority Backlog
Tasks to tackle when time permits:
```
not done
priority is low
sort by due
limit 50
```

### Priority Distribution
See how tasks are distributed by priority:
```
not done
group by priority
```

## Project Management

### Project Tasks (by Tag)
All tasks for a specific project:
```
tag includes #project-alpha
not done
sort by due
```

### Work vs Personal
Separate work and personal tasks:
```
tag includes #work
not done
group by priority
```

### Tasks Without Tags
Find unorganized tasks:
```
no tags
not done
sort by created reverse
```

### Multi-tag Filter
Tasks with specific tag combination:
```
tag includes #work
tag includes #urgent
not done
sort by due
```

### Project Status Overview
Group project tasks by status:
```
tag includes #project-alpha
group by status.type
```

## Review & Maintenance

### Unscheduled Tasks
Tasks without scheduled dates:
```
no scheduled date
not done
sort by due
```

### Tasks Without Due Dates
Items that need date assignment:
```
no due date
not done
sort by created reverse
```

### Recently Created
New tasks to review:
```
created on or after last week
sort by created reverse
```

### Stale Tasks
Long-standing incomplete tasks:
```
not done
created on or before last month
sort by created
```

### Blocked Tasks Audit
Review dependency blockers:
```
is blocked
not done
sort by due
```

### Completed This Month
Monthly achievement review:
```
done
done on or after this month
sort by done reverse
```

## Advanced Patterns

### Deep Work Sessions
High-priority, unblocked, scheduled tasks:
```
not done
priority above normal
is not blocked
has scheduled date
scheduled on today
sort by priority reverse
```

### Quick Wins
Low-effort tasks for momentum:
```
not done
priority is low
tag includes #quick
sort by due
limit 10
```

### Recurring Task Review
Check recurring task patterns:
```
is recurring
group by priority
```

### Context Switching Helper
Tasks for current context:
```
tag includes #context/office
not done
is not blocked
sort by priority reverse
limit 5
```

### End of Day Cleanup
Incomplete tasks to reschedule:
```
not done
due on today
is not blocked
sort by priority reverse
```

### Dependency Chain Review
Tasks that are blocking others:
```
is blocking
not done
sort by due
```

### Archive-Ready Tasks
Completed tasks from last quarter:
```
done
done on or before last month
path does not include archive/
sort by done
```

## Troubleshooting

### Common Issues

#### Query Not Returning Expected Results

**Problem:** Too few results
```
# Check if filters are too restrictive
# Try removing filters one by one
not done
# Add more filters gradually
```

**Problem:** Too many results
```
# Add more specific filters
not done
due before next week
priority above normal
limit 20
```

#### Date Filters Not Working

**Problem:** Tasks with no dates don't appear
```
# Make sure to check for date presence first
has due date
due before today
```

**Problem:** Natural language date not parsing
```
# Use ISO format as fallback
due before 2025-01-20
# Instead of potentially ambiguous formats
```

#### Grouping Issues

**Problem:** Too many small groups
```
# Use broader grouping
group by priority
# Instead of status which may have many values
```

**Problem:** Groups not in desired order
```
# Add sorting before grouping
sort by priority reverse
group by due
```

### Query Validation

If your query isn't working, validate it step by step:

1. Start with simplest filter:
```
not done
```

2. Add one filter at a time:
```
not done
due before today
```

3. Add sorting when filtering works:
```
not done
due before today
sort by due
```

4. Finally add grouping/limiting:
```
not done
due before today
sort by due
limit 10
```

### Performance Optimization

If queries are slow:

1. **Use date filters early** - they're indexed:
```
due before next week
not done
# Instead of
not done
due before next week
```

2. **Limit results when possible**:
```
not done
due before today
sort by due
limit 20  # Only need top 20
```

3. **Avoid unnecessary grouping** on large result sets:
```
# This may be slow with 1000+ tasks
group by tags

# This is faster
group by priority
```

## Query Templates

Copy and customize these templates for your needs:

### Daily Dashboard
```
not done
due on or before today
is not blocked
sort by priority reverse
limit 15
```

### Weekly Plan
```
not done
due on or before next week
group by due
```

### Priority Inbox
```
not done
priority above normal
is not blocked
sort by due
limit 25
```

### Project Dashboard
```
tag includes #PROJECT_NAME
not done
group by status.type
```

### Review Queue
```
done
done on or after last week
sort by done reverse
limit 50
```

## Tips & Best Practices

1. **Start Simple**: Begin with basic filters and add complexity as needed
2. **Use Templates**: Save common queries for quick access
3. **Validate Gradually**: Build queries incrementally to catch errors early
4. **Limit Results**: Use `limit` to keep views manageable
5. **Group Wisely**: Group by fields with few distinct values (priority, status) rather than many (tags, path)
6. **Sort Before Grouping**: Sorting affects the order within groups
7. **Check Date Presence**: Use `has X date` before date comparisons to avoid unexpected results
8. **Use Natural Dates**: `tomorrow` is easier than calculating dates manually
9. **Tag Strategically**: Consistent tagging makes filtering more effective
10. **Review Regularly**: Update queries as your workflow evolves

## Getting Help

If you encounter issues:

1. Check the [Query Language Reference](./query-language.md)
2. Validate your query syntax
3. Review error messages for specific guidance
4. Start with a working example from this cookbook
5. Build complexity gradually

## Contributing

Have a useful query pattern? Consider sharing it with the community!
