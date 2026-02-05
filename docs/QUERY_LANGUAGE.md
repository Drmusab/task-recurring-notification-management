# Query Language Reference

## Overview
The query language allows you to filter, sort, and group tasks using a text-based syntax.

## Core Filters

### 1. Status Filters
```
done                          # Completed tasks
not done                      # Incomplete tasks
status.type is TODO           # Tasks with TODO status
status.type is IN_PROGRESS    # Tasks in progress
status.type is DONE           # Completed tasks
status.type is CANCELLED      # Cancelled tasks
```

### 2. Priority Filters
```
priority is high              # High priority tasks
priority is medium            # Medium priority tasks
priority is low               # Low priority tasks
priority is lowest            # Lowest priority tasks
priority is highest           # Highest priority tasks
priority above low            # Tasks with priority > low
priority below high           # Tasks with priority < high
```

Supported priority levels:
- `lowest` (weight: 0)
- `low` (weight: 1)
- `none` / `normal` / `medium` (weight: 2)
- `high` (weight: 3)
- `highest` / `urgent` (weight: 4)

### 3. Date Filters

Date filters support both ISO date format (YYYY-MM-DD) and natural language expressions.

#### Basic Date Comparisons
```
due today                     # Due today
due before tomorrow           # Due before tomorrow
due after 2025-01-15          # Due after specific date
due on 2025-01-20             # Due on specific date
due on or before today        # Due on or before today
due on or after tomorrow      # Due on or after tomorrow
has due date                  # Has a due date set
no due date                   # No due date
scheduled before next week    # Scheduled before next week
scheduled after yesterday     # Scheduled after yesterday
start after yesterday         # Starts after yesterday
start before next Monday      # Starts before next Monday
```

#### Date Ranges with "between"
The `between` operator allows you to filter tasks within a date range:
```
due between 2026-01-20 and 2026-01-30           # ISO dates
due between today and next Friday               # Natural language
scheduled between in 7 days and in 14 days      # Relative dates
start between January 15 and January 31         # Month names
```
Both the start and end dates are inclusive.

#### Natural Language Date Support
The query engine supports comprehensive natural language date parsing:

**Relative keywords:**
- `today`, `tomorrow`, `yesterday`
- `next Monday`, `last Friday` (any day of week)
- `next week`, `last week`, `this week`
- `next month`, `last month`, `this month`

**Relative expressions:**
- `in 3 days`, `in 2 weeks`, `in 1 month`
- `3 days ago`, `2 weeks ago`, `1 month ago`
- `two weeks from now`

**Absolute dates:**
- `2026-01-15` (ISO format)
- `January 15`, `Jan 15, 2026`
- `15 Jan`, `15 January 2026`

**Examples:**
```
due before next Friday                          # Tasks due before next Friday
scheduled in the next 7 days                    # Use: scheduled before in 7 days
due after tomorrow AND priority high            # Combining with other filters
start between today and in 2 weeks              # Two week window
created after January 1, 2026                   # Using month names
```

Supported date fields:
- `due` - Due date
- `scheduled` - Scheduled date
- `start` - Start date
- `created` - Creation date
- `done` - Completion date
- `cancelled` - Cancellation date

### 4. Tag Filters
```
tag includes #work            # Has #work tag
tag does not include #personal # Does not have #personal tag
tags include #important       # Alternative syntax
has tags                      # Has any tags
no tags                       # Has no tags
```

### 5. Path Filters
```
path includes projects        # Path contains "projects"
path does not include archive # Path does not contain "archive"
```

### 6. Description Filters
```
description includes meeting  # Name/description contains "meeting"
description does not include urgent # Does not contain "urgent"
description regex urgent|asap # Matches regex pattern (case-insensitive)
```

The description filter searches both the task name and description fields.

### 7. Heading Filters
```
heading includes Work         # Document heading contains "Work"
heading does not include Personal # Heading does not contain "Personal"
```

The heading filter searches the document heading/section where the task is located. This is useful for filtering tasks based on their location within a document's structure.

### 8. Recurrence Filters
```
is recurring                  # Recurring tasks
is not recurring              # Non-recurring tasks
```

### 9. Dependency Filters
```
is blocked                    # Blocked by other tasks
is not blocked                # Not blocked
is blocking                   # Blocking other tasks
```

## Boolean Operators

Combine filters using boolean operators:

```
not done AND priority high
due today OR due tomorrow
NOT is blocked
(priority high OR priority urgent) AND not done
```

Supported operators:
- `AND` - Both conditions must be true
- `OR` - At least one condition must be true
- `NOT` - Negates the condition

## Sorting

Sort results by various fields:

```
sort by due                   # Sort by due date
sort by priority              # Sort by priority
sort by priority reverse      # Reverse sort
sort by created               # Sort by creation date
sort by heading               # Sort by document heading
sort by path                  # Sort by file path
sort by description           # Sort by description
```

## Grouping

Group results by various fields:

```
group by priority             # Group by priority level
group by due                  # Group by due date
group by status.type          # Group by status type
group by folder               # Group by folder
group by tags                 # Group by tags
group by path                 # Group by full path
```

## Limiting Results

Limit the number of results returned:

```
limit 10                      # Limit to 10 results
limit to 25 tasks             # Limit to 25 results
```

## Date Values

The query language supports comprehensive natural language date parsing powered by chrono-node, as well as ISO format dates.

### Relative Dates
- `today`, `tomorrow`, `yesterday`
- `next week`, `last week`, `this week`
- `next month`, `last month`, `this month`
- `in 3 days`, `in 2 weeks`, `in 1 month`
- `3 days ago`, `2 weeks ago`, `1 month ago`
- `next Monday`, `last Friday` (any day of the week)
- `two weeks from now` (alternative phrasing)

### Absolute Dates
- `2025-01-20` (ISO format: YYYY-MM-DD)
- `January 15`, `Jan 15` (month and day)
- `January 15, 2026`, `Jan 15, 2026` (full date with year)
- `15 Jan`, `15 January` (day first format)

### Date Normalization
All dates are normalized to midnight (00:00:00) for consistent comparison. This ensures that queries like `due on today` match tasks regardless of their time component.

## Query Examples

### Basic Filtering
```
# Show incomplete tasks
not done

# Show high priority tasks
priority high

# Show tasks due today
due today

# Show recurring tasks
is recurring

# Show tasks in Work section
heading includes Work
```

### Advanced Filtering
```
# Incomplete high priority tasks
not done AND priority high

# Tasks due today or tomorrow
due today OR due tomorrow

# Incomplete tasks with a due date
not done AND has due date

# Tasks with "meeting" in description
description includes meeting

# Tasks in Work Projects section
heading includes "Work Projects"

# Tasks NOT in Personal section
heading does not include Personal

# High priority or urgent tasks that are not done
(priority high OR priority urgent) AND not done
```

### Sorting and Grouping
```
# Show all incomplete tasks, sorted by priority
not done
sort by priority

# Group incomplete tasks by priority
not done
group by priority

# Show next 10 tasks due
not done
sort by due
limit 10
```

### Complex Queries
```
# High priority incomplete tasks due this week
not done
priority high
due after today
due before next week
sort by due

# Tasks due in the next 7 days with natural language
not done
due between today and in 7 days
sort by due

# Tasks due between specific dates
not done
due between 2026-01-20 and 2026-01-30
group by priority

# Recurring tasks with tags
is recurring
has tags
group by tags

# Blocked tasks that are not done
is blocked
not done
sort by priority reverse

# Work tasks grouped by heading
heading includes Work
not done
group by heading
sort by priority

# Tasks scheduled for next week using natural language
scheduled between next Monday and next Friday
not done
sort by priority

# Overdue tasks (before today) that are high priority
due before today
priority is high
not done
sort by due
```

### Natural Language Date Examples
```
# Tasks due next Friday
due on next Friday
not done

# Tasks due in the next two weeks
due between today and in 14 days
not done

# Tasks created in January
created between January 1 and January 31
group by priority

# Tasks scheduled for this week
scheduled between this week and next week
not done

# Tasks due tomorrow or day after
due between tomorrow and in 2 days
priority above medium
```

## Dependency Filters (NEW)

Tasks can have dependencies on other tasks. Use these filters to find tasks based on their dependency status.

### Is Blocking
Find tasks that are blocking other tasks (other tasks depend on these):
```
is blocking
```

Find tasks that are not blocking any other tasks:
```
is not blocking
```

### Is Blocked
Find tasks that are blocked by dependencies (waiting on other tasks):
```
is blocked
```

Find tasks that are not blocked (ready to work on):
```
is not blocked
```

### Dependency Examples
```
# Find all tasks ready to work on (not blocked)
is not blocked
status is todo

# Find high-priority tasks that are blocking others
is blocking
priority above normal

# Find overdue tasks that are blocking others
is blocking
due before today
status is todo
```

## Query Placeholders (NEW)

Placeholders allow you to create dynamic queries that reference the current file context. This is especially useful for queries embedded in note files.

### Available Placeholders

| Placeholder | Description | Example Value |
|------------|-------------|---------------|
| `{{query.file.path}}` | Full path to current file | `projects/work/meeting-notes.md` |
| `{{query.file.folder}}` | Parent folder of current file | `projects/work` |
| `{{query.file.name}}` | Current file name | `meeting-notes.md` |
| `{{query.file.root}}` | Top-level folder | `projects` |

### Placeholder Examples

**Show all tasks in current folder:**
```
path includes {{query.file.folder}}
status is todo
sort by due
```

**Show tasks from same project (root folder) excluding current file:**
```
path includes {{query.file.root}}
path does not include {{query.file.name}}
is not blocked
sort by urgency
```

**Daily note - show tasks scheduled for same folder:**
```
path includes {{query.file.folder}}
has scheduled date
scheduled before tomorrow
sort by priority
```

**Project dashboard - show all project tasks:**
```
path includes {{query.file.root}}/{{query.file.folder}}
status is todo
group by priority
```

### How Placeholders Work

1. Placeholders are resolved **before** the query is parsed
2. The file context comes from where the query is embedded/executed
3. If no context is available, placeholders resolve to empty strings
4. Multiple placeholders can be used in the same query

### Placeholder Use Cases

- **Project-specific queries**: Show tasks only from the current project
- **Folder-based filtering**: Organize tasks by folder structure
- **Context-aware dashboards**: Embedded queries that adapt to their location
- **Template queries**: Reusable query templates for different folders

## Tips and Best practices

1. **Use multiple lines**: Each filter, sort, group, or limit instruction should be on its own line.

2. **Case sensitivity**: Keywords and operators are case-insensitive, but values (like tags and paths) are case-sensitive.

3. **Quotes**: Use quotes around values with spaces: `tag includes "my tag"`

4. **Date formats**: Prefer ISO format (YYYY-MM-DD) for absolute dates for consistency.

5. **Combining filters**: Multiple filters on separate lines are combined with AND logic by default.

6. **Performance**: More specific filters first can improve query performance.

## Error Handling

If a query fails to parse or execute, you'll receive an error message indicating:
- The line and column where the error occurred
- A description of the problem
- Suggestions for fixing the error

Example error:
```
QuerySyntaxError: Unknown filter instruction: "priority is super-high"
  at line 1, column 1
  Hint: Check the query syntax documentation for valid filter instructions
```

## Validation

You can validate a query without executing it using the `validateQuery` API:

```typescript
const engine = new QueryEngine(taskIndex);
const result = engine.validateQuery("not done AND priority high");

if (result.valid) {
  console.log("Query is valid");
  console.log("Parsed filters:", result.parsedFilters);
} else {
  console.error("Query error:", result.error);
}
```
