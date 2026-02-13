# Query Language Reference

Complete reference for the SiYuan Task Management Plugin query language.

## Table of Contents

- [Query Syntax](#query-syntax)
- [Operators](#operators)
- [Field Reference](#field-reference)
- [Query Examples](#query-examples)
- [Best Practices](#best-practices)

## Query Syntax

### Basic Structure

```
[field] [operator] [value]
```

Examples:
```
status is done
priority is high
due before today
tag includes #work
```

### Logical Operators

Combine multiple conditions:

| Operator | Symbol | Example |
|----------|--------|---------|
| AND | `AND` | `not done AND priority is high` |
| OR | `OR` | `due today OR scheduled today` |
| NOT | `NOT` | `NOT tag includes #archived` |
| Parentheses | `()` | `(due today) AND (priority is high OR tag includes #urgent)` |

**Operator Precedence:**
1. NOT (highest)
2. AND
3. OR (lowest)

**Use parentheses** to override default precedence.

### Sorting

```
[query] sort by [field] [asc|desc]
```

Examples:
```
not done sort by due asc
priority is high sort by priority desc, due asc
```

**Multi-field sorting:**
```
sort by priority desc, due asc, created desc
```

### Grouping

```
[query] group by [field]
```

Examples:
```
not done group by status
tag includes #work group by priority
```

**Note:** Only one grouping field supported per query.

## Operators

### Comparison Operators

| Operator | Usage | Example | Description |
|----------|-------|---------|-------------|
| `is` | `field is value` | `status is done` | Exact match (case-insensitive) |
| `is not` | `field is not value` | `priority is not low` | Not equal |
| `includes` | `field includes value` | `tag includes #work` | Contains substring or array element |
| `not includes` | `field not includes value` | `path not includes archive` | Does not contain |
| `before` | `field before date` | `due before today` | Date is earlier than |
| `after` | `field after date` | `due after 2026-02-01` | Date is later than |
| `matches` | `field matches regex` | `path matches .*daily.*` | Regex pattern match |
| `not matches` | `field not matches regex` | `name not matches ^Draft` | Regex no match |

### Special Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `done` | `done` | Shorthand for `status is done` |
| `not done` | `not done` | Shorthand for `status is not done` |
| `has due date` | `has due date` | Task has a due date set |
| `no due date` | `no due date` | Task has no due date |
| `has recurrence` | `has recurrence` | Task is recurring |
| `is blocked` | `is blocked` | Task has incomplete dependencies |
| `is not blocked` | `is not blocked` | Task has no dependencies or all complete |
| `is blocking` | `is blocking` | Other tasks depend on this one |
| `depends on` | `depends on task-abc` | This task depends on specific ID |
| `blocks` | `blocks task-xyz` | This task blocks specific ID |

## Field Reference

### Task Status

```
status is [value]
status.type is [type]
```

**Status Values:**
- `todo`, `done`, `in-progress`, `cancelled`, `forwarded`, etc.

**Status Types:**
- `TODO` - Open task
- `IN_PROGRESS` - Actively working
- `DONE` - Completed
- `CANCELLED` - Won't do
- `NON_TASK` - Not a task (informational)

### Dates

```
due [operator] [date]
scheduled [operator] [date]
start [operator] [date]
created [operator] [date]
done [operator] [date]
cancelled [operator] [date]
```

**Date Values:**
- ISO format: `2026-02-10`
- Natural language: `today`, `tomorrow`, `yesterday`
- Relative: `+7d` (7 days from now), `-2w` (2 weeks ago)

**Date Operators:**
- `before`, `after`, `is`

### Priority

```
priority is [level]
priority is not [level]
```

**Priority Levels:**
- `highest`, `high`, `medium`, `low`, `lowest`

**Note:** Tasks without priority are treated as "normal" (between medium and low).

### Tags

```
tag includes [tag]
tag is [tag]
```

**Hierarchical Matching:**
- `tag includes #project` matches `#project/alpha`, `#project/beta`, etc.
- `tag is #project` matches exactly (no hierarchy)

### Path

```
path includes [substring]
path matches [regex]
```

Examples:
```
path includes daily/
path matches .*2026-02.*
```

### Dependencies

```
is blocked
is not blocked
is blocking
depends on [task-id]
blocks [task-id]
```

**Computed States:**
- `is blocked` - Has incomplete dependencies
- `is not blocked` - Ready to work on
- `is blocking` - Other tasks waiting on this

### Other Fields

```
name includes [text]
name matches [regex]
description includes [text]
```

## Query Examples

### Status & Completion

**All open tasks:**
```
not done
```

**Completed today:**
```
done AND done.date is today
```

**In progress tasks:**
```
status.type is IN_PROGRESS
```

**Cancelled or done:**
```
status is done OR status is cancelled
```

### Date-Based Queries

**Due today:**
```
due today
```

**Overdue:**
```
due before today AND not done
```

**This week:**
```
due after today AND due before +7d
```

**Scheduled for tomorrow:**
```
scheduled is tomorrow
```

**Created in the last 7 days:**
```
created after -7d
```

**No due date set:**
```
no due date AND not done
```

### Priority & Tags

**High priority tasks:**
```
priority is high
```

**High or highest priority:**
```
priority is high OR priority is highest
```

**Work-related tasks:**
```
tag includes #work
```

**Project alpha tasks:**
```
tag includes #project/alpha
```

**Work tasks not archived:**
```
tag includes #work AND NOT tag includes #archived
```

### Dependencies

**Available to work on (not blocked):**
```
not done AND is not blocked
```

**Blocked tasks:**
```
is blocked
```

**Tasks blocking others:**
```
is blocking
```

**Tasks depending on design:**
```
depends on design-mockups
```

### Path-Based Queries

**Tasks in daily notes:**
```
path includes daily/
```

**Tasks in current month:**
```
path matches .*2026-02.*
```

**Tasks not in archive:**
```
NOT path includes archive/
```

### Complex Queries

**Today's high-priority work:**
```
(due today OR scheduled today) AND priority is high AND tag includes #work
```

**Available urgent tasks:**
```
not done AND is not blocked AND (priority is highest OR tag includes #urgent)
```

**Overdue project tasks:**
```
due before today AND not done AND tag includes #project
```

**Completed work tasks this week:**
```
done AND done.date after -7d AND tag includes #work
```

### Sorted Queries

**Tasks by due date:**
```
not done sort by due asc
```

**High priority first, then by due date:**
```
not done sort by priority desc, due asc
```

**Recently created:**
```
not done sort by created desc
```

### Grouped Queries

**Tasks by status:**
```
not done group by status
```

**Work tasks by priority:**
```
tag includes #work group by priority
```

**Tasks by tag:**
```
not done group by tag
```

## Best Practices

### Query Performance

**Fast queries:**
- Use specific filters: `status is done` instead of `done`
- Limit date ranges: `due after 2026-02-01` instead of no filter
- Use field-specific operators: `tag includes` instead of `name includes`

**Slow queries:**
- Regex on large fields: `name matches .*complicated.*pattern.*`
- No filters: querying all 10k tasks
- Complex grouping with many unique values

### Query Organization

**Use saved queries for common views:**

```
Today's Focus:
  (due today OR scheduled today) AND not done AND is not blocked

Weekly Review:
  done AND done.date after -7d

Next Actions:
  not done AND is not blocked AND (priority is high OR tag includes #next)
```

### Debugging Queries

**Build incrementally:**

1. Start simple: `not done`
2. Add one filter: `not done AND priority is high`
3. Add another: `not done AND priority is high AND tag includes #work`
4. Add sorting: `not done AND priority is high AND tag includes #work sort by due asc`

**Test with known tasks:**
- Create test tasks with known properties
- Verify query returns expected results
- Refine filters as needed

### Query Patterns

**GTD (Getting Things Done):**
```
Inbox: not done AND no due date AND no tag
Next: not done AND tag includes #next
Waiting: not done AND tag includes #waiting
Someday: not done AND tag includes #someday
```

**Eisenhower Matrix:**
```
Urgent & Important: priority is high AND due before +3d
Important Not Urgent: priority is high AND (no due date OR due after +3d)
Urgent Not Important: priority is low AND due before +3d
Not Urgent Not Important: priority is low AND (no due date OR due after +3d)
```

**Agile/Scrum:**
```
Backlog: not done AND tag includes #backlog
Sprint: not done AND tag includes #sprint
In Progress: status.type is IN_PROGRESS
Done: done AND done.date after -14d
Blocked: is blocked
```

## Operator Cheat Sheet

```
# Comparison
field is value
field is not value
field includes substring
field not includes substring
field before date
field after date
field matches regex
field not matches regex

# Logical
condition1 AND condition2
condition1 OR condition2
NOT condition
(condition)

# Special
done
not done
has due date
no due date
has recurrence
is blocked
is not blocked
is blocking
depends on task-id
blocks task-id

# Sorting
query sort by field asc
query sort by field desc
query sort by field1 desc, field2 asc

# Grouping
query group by field
```

## Grammar (EBNF)

For developers implementing query parsers:

```ebnf
query          ::= expression ( sort )? ( group )?
expression     ::= or_expression
or_expression  ::= and_expression ( 'OR' and_expression )*
and_expression ::= not_expression ( 'AND' not_expression )*
not_expression ::= 'NOT' primary_expression | primary_expression
primary_expression ::= '(' expression ')' | comparison | shortcut
comparison     ::= field operator value
shortcut       ::= 'done' | 'not done' | 'has due date' | 'is blocked' | etc.
sort           ::= 'sort by' sort_field ( ',' sort_field )*
sort_field     ::= field ( 'asc' | 'desc' )
group          ::= 'group by' field
field          ::= identifier ( '.' identifier )?
operator       ::= 'is' | 'is not' | 'includes' | 'not includes' | 'before' | 'after' | 'matches' | 'not matches'
value          ::= string | date | identifier
```
