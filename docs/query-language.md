# Query Language Reference

This document describes the complete query language syntax for filtering, sorting, and grouping tasks.

## Overview

The query language allows you to filter tasks using natural language syntax similar to 1 Tasks. Each query can contain multiple instructions, one per line:

```
not done
due before today
priority is high
sort by due
limit 10
```

## Query Structure

A query consists of one or more instructions:

- **Filter Instructions**: Filter tasks based on criteria
- **Sort Instructions**: Order results by a field
- **Group Instructions**: Group results by a field
- **Limit Instructions**: Limit the number of results

## Filter Instructions

### Simple Filters

#### Done/Not Done
```
done          # Tasks marked as complete
not done      # Tasks not marked as complete
```

### Status Filters

Filter by task status type:
```
status.type is TODO
status.type is IN_PROGRESS
status.type is DONE
status.type is CANCELLED
status.type is NON_TASK
```

Filter by status name (partial match, case-insensitive):
```
status.name includes waiting
status.name includes progress
```

Filter by status symbol (the character in the checkbox):
```
status.symbol is x
status.symbol is /
status.symbol is -
```

### Date Filters

#### Date Comparison

Available date fields: `due`, `scheduled`, `start`, `created`, `done`, `cancelled`

Available comparators: `before`, `after`, `on`, `on or before`, `on or after`

```
due before today
due after tomorrow
scheduled before 2025-01-20
start on 2025-02-01
done on or before today
created on or after 2025-01-01
```

#### Date Presence

```
has due date
no due date
has scheduled date
no scheduled date
has start date
no start date
```

#### Natural Language Dates

The following date formats are supported:

**Keywords:**
- `today`
- `tomorrow`
- `yesterday`

**Relative dates:**
- `in 3 days`
- `in 2 weeks`
- `in 1 month`
- `3 days ago`
- `2 weeks ago`

**Day names:**
- `next Monday`
- `next Tuesday`
- `last Friday`

**Weeks and months:**
- `this week`
- `next week`
- `last week`
- `this month`
- `next month`
- `last month`

**ISO format:**
- `2025-01-20`
- `2025-12-31`

### Priority Filters

Available priority levels: `lowest`, `low`, `normal`, `medium`, `high`, `highest`

```
priority is high
priority above medium
priority below high
```

Note: `normal` and `medium` are equivalent.

### Tag Filters

```
tag includes #work
tag includes #urgent
tags include #project
tag does not include #someday
has tags
no tags
```

### Path Filters

```
path includes daily/
path includes projects/
path does not include archive/
```

Note: Path filtering requires tasks to have a `path` field.

### Dependency Filters

```
is blocked          # Tasks blocked by dependencies
is not blocked      # Tasks not blocked
is blocking         # Tasks blocking other tasks
```

### Recurrence Filters

```
is recurring        # Tasks with recurrence rules
is not recurring    # One-time tasks
```

## Sort Instructions

Sort results by a field:

```
sort by due
sort by scheduled
sort by start
sort by priority
sort by status.type
sort by created
sort by done
sort by description
sort by path
```

Add `reverse` to sort in descending order:

```
sort by due reverse
sort by priority reverse
```

## Group Instructions

Group results by a field:

```
group by due
group by scheduled
group by status.type
group by status.name
group by priority
group by path
group by folder
group by tags
```

### Grouping Behavior

**Date grouping** (`due`, `scheduled`):
- Overdue
- Today
- Tomorrow
- This Week
- Later
- No due date

**Status grouping** (`status.type`, `status.name`):
- Groups by status type or name

**Priority grouping** (`priority`):
- Groups by priority level (Low, Normal, High, Urgent)

**Path grouping** (`path`, `folder`):
- `path`: Groups by full path
- `folder`: Groups by folder (parent path)

**Tag grouping** (`tags`):
- Tasks appear in each tag group they belong to
- Tasks with no tags appear in "No tags" group

## Limit Instructions

Limit the number of results:

```
limit 10
limit 25
limit to 50 tasks
limit to 100 tasks
```

## Complex Queries

Combine multiple instructions:

```
# Find urgent incomplete work tasks due soon
not done
tag includes #work
priority above normal
due before next week
sort by due
limit 10
```

```
# Review all high priority tasks by status
priority is high
group by status.type
sort by due
```

```
# Find overdue tasks
not done
due before today
sort by due reverse
```

```
# Weekly planning: tasks for this week
not done
due on or before next week
has tags
sort by priority reverse
group by due
```

## Performance Tips

1. **Use specific filters first**: More specific filters (like date ranges) reduce the result set faster
2. **Limit early when possible**: If you only need top results, apply limit to reduce processing
3. **Avoid complex grouping on large result sets**: Grouping is computed after filtering
4. **Date indexes are fast**: Queries using date filters are optimized

## Examples

### Daily Review
```
not done
due on today
sort by priority reverse
```

### Weekly Planning
```
not done
due on or before next week
group by due
```

### High Priority Items
```
not done
priority above normal
sort by due
```

### Work Tasks
```
tag includes #work
not done
sort by due
limit 20
```

### Blocked Tasks
```
is blocked
not done
sort by due
```

### Recently Completed
```
done
done on or after last week
sort by done reverse
```

### Find Orphaned Tasks
```
no tags
no scheduled date
not done
sort by created
```

## Error Handling

When a query has invalid syntax, you'll receive an error message with:
- Line and column number of the error
- Description of the problem
- Suggestion for fixing it

Example error:
```
QuerySyntaxError: Invalid date value: "invalid-date" (line 1, column 1)
Suggestion: Use formats like: today, tomorrow, YYYY-MM-DD, "in 3 days", "next Monday"
```

## Field Reference

### Available Date Fields
- `due` - Task due date
- `scheduled` - When task is scheduled to be worked on
- `start` - Earliest date task can begin
- `created` - Task creation date
- `done` - Task completion date
- `cancelled` - Task cancellation date

### Available Sort Fields
- `due` - Due date
- `scheduled` - Scheduled date
- `start` - Start date
- `priority` - Priority level
- `status.type` - Status type
- `created` - Creation date
- `done` - Completion date
- `description` - Task description
- `path` - File path

### Available Group Fields
- `due` - Due date (semantic grouping)
- `scheduled` - Scheduled date (semantic grouping)
- `status.type` - Status type
- `status.name` - Status name
- `priority` - Priority level
- `path` - Full path
- `folder` - Parent folder
- `tags` - Task tags

## Future Enhancements

The query language may be extended in the future to support:
- Boolean expressions with parentheses: `(A OR B) AND C`
- Custom date ranges: `due in range 2025-01-01 to 2025-01-31`
- Regular expressions: `description matches /pattern/`
- Numeric comparisons: `completion count > 5`
- Advanced grouping: multiple group levels
