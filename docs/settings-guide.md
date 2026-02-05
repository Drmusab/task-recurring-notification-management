# Settings Guide

Complete explanation of all plugin settings with examples and recommendations.

---

## Table of Contents

1. [Global Filter](#global-filter)
2. [Task Format](#task-format)
3. [Status Definitions](#status-definitions)
4. [Performance Settings](#performance-settings)
5. [Feature Flags](#feature-flags)
6. [Advanced Settings](#advanced-settings)

---

## Global Filter

Control what counts as a task in your workspace.

### Overview

The Global Filter determines which checkboxes in your notes are treated as tasks by the plugin. This prevents the plugin from managing simple checklists that aren't actual tasks.

### Filter Modes

#### Include Mode

Only treat checkboxes as tasks if they match the specified pattern.

**Use case:** You want explicit control over what becomes a task.

**Example Settings:**
- **Tag pattern:** `#task`
  - `- [ ] Buy milk #task` → Treated as task ✅
  - `- [ ] Buy milk` → Not a task ❌

- **Multiple tags:** `#task|#todo`
  - Matches either `#task` OR `#todo`

#### Exclude Mode

Treat all checkboxes as tasks EXCEPT those matching the pattern.

**Use case:** Most of your checkboxes are tasks, but you want to exclude specific ones.

**Example Settings:**
- **Tag pattern:** `#checklist`
  - `- [ ] Buy milk` → Treated as task ✅
  - `- [ ] Buy milk #checklist` → Not a task ❌

### Pattern Types

#### Tag Pattern

Filter based on hashtags in the task description.

**Syntax:** Regular expression or simple tag
- `#task` - Simple tag
- `#task|#todo` - Multiple tags (OR)
- `#project/.+` - Any tag starting with #project/

**Examples:**
```
✅ Include mode with #task:
- [ ] Review PR #task           → Task
- [ ] Grocery list              → Not a task

✅ Exclude mode with #notes:
- [ ] Complete assignment       → Task
- [ ] Remember this #notes      → Not a task
```

#### Path Pattern

Filter based on the file path or folder.

**Syntax:** File path or glob pattern
- `tasks/` - Only in tasks folder
- `projects/work/` - Specific subfolder
- `daily-notes/` - Daily notes folder

**Examples:**
```
✅ Include mode with tasks/:
File: tasks/work.md
- [ ] Task 1                    → Task

File: notes/ideas.md
- [ ] Task 2                    → Not a task
```

#### Regex Pattern

Advanced pattern matching using regular expressions.

**Use case:** Complex filtering requirements

**Examples:**
- `\[priority::.+\]` - Only items with priority metadata
- `\[due::.+\]` - Only items with due dates
- `@\w+` - Only items with @mentions

### Recommendations

| Scenario | Recommended Setting |
|----------|---------------------|
| New workspace | Include mode with `#task` tag |
| Existing workspace with many checkboxes | Exclude mode with `#checklist` |
| Project management | Path pattern: `projects/` |
| Personal tasks only | Include mode with `#personal` |

---

## Task Format

Choose between emoji and text-based metadata formats.

### Emoji Format (Recommended)

Uses visual icons for quick scanning.

**Pros:**
- Visual and intuitive
- Fast to scan
- Works well in mobile apps

**Example:**
```
- [ ] Submit report 📅 2025-01-20 ⏫ #work
```

### Text Format

Uses bracketed key-value pairs.

**Pros:**
- More explicit
- Better for screen readers
- Plain text friendly

**Example:**
```
- [ ] Submit report [due:: 2025-01-20] [priority:: high] #work
```

### Switching Formats

When you change the task format setting:
1. New tasks will use the selected format
2. Existing tasks remain in their original format
3. Both formats are always supported for reading

---

## Status Definitions

Customize checkbox symbols and the toggle cycle.

### Default Status Cycle

```
[ ] TODO → [/] IN_PROGRESS → [x] DONE → [ ] TODO
```

### Custom Status Symbols

You can define custom symbols for different states:

| Status Type | Default Symbol | Alternative Symbols |
|-------------|----------------|---------------------|
| TODO        | ` ` (space)    | `-`, `o`            |
| IN_PROGRESS | `/`            | `>`, `!`            |
| DONE        | `x`            | `X`                 |
| CANCELLED   | `-`            | `~`                 |

### Toggle Behavior

**Single-click toggle:**
- Cycles through: TODO → IN_PROGRESS → DONE → TODO

**Ctrl/Cmd + click:**
- Quick toggle: TODO ↔ DONE (skips IN_PROGRESS)

### Custom Cycles

You can define custom toggle cycles in settings:

**Example: Two-state cycle**
```
TODO → DONE → TODO
```

**Example: Four-state cycle**
```
TODO → SCHEDULED → IN_PROGRESS → DONE → TODO
```

---

## Performance Settings

Optimize plugin performance for large workspaces.

### Index Refresh Mode

Controls how often the task index is rebuilt.

#### Realtime (Default)

Updates immediately when blocks change.

**Pros:** Always up-to-date
**Cons:** Higher CPU usage

**Use when:** You have < 1000 tasks

#### Debounced

Waits 300ms after changes before updating.

**Pros:** Reduces CPU usage during rapid edits
**Cons:** Slight delay in updates

**Use when:** You have 1000-5000 tasks

#### Manual

Updates only when you manually refresh.

**Pros:** Minimal CPU usage
**Cons:** Must remember to refresh

**Use when:** You have > 5000 tasks

### Scoped Notebooks

Limit which notebooks are indexed for tasks.

**Example:**
```
Indexed notebooks:
- /projects
- /work
- /personal-tasks

Ignored notebooks:
- /archive
- /references
- /notes
```

**Benefits:**
- Faster indexing
- Reduced memory usage
- Focus on relevant tasks

### Max Tasks to Load

Set a limit on the number of tasks loaded into memory.

**Default:** 0 (unlimited)
**Recommended for large workspaces:** 5000

**Note:** Older completed tasks are archived and not counted toward this limit.

### Cache Settings

#### Task Cache TTL

How long to cache task data in memory.

**Default:** 5 minutes
**Range:** 1-60 minutes

**Recommendation:** 
- 1 minute for active editing
- 10 minutes for stable workspaces

#### Index Rebuild Threshold

Number of task changes before triggering a full index rebuild.

**Default:** 100
**Range:** 10-1000

---

## Feature Flags

Enable or disable specific features gradually.

### Available Flags

#### Emoji Task Format

**Status:** Enabled by default
**Description:** Parse tasks with emoji metadata (📅, ⏳, 🛫)

**When to disable:** If you prefer text-only format

#### Task Dependencies

**Status:** Enabled by default
**Requires restart:** Yes
**Description:** Enable blocking/blocked task relationships

**Use case:** Project management with task dependencies

#### Advanced Query Language

**Status:** Enabled by default
**Description:** Enable full query syntax with filters and grouping

**When to disable:** If you only use simple task lists

#### Filename as Date

**Status:** Disabled by default
**Description:** Infer scheduled date from daily note filenames

**Example:**
- File: `2025-01-20.md`
- Task: `- [ ] Morning standup`
- Auto-scheduled: 2025-01-20

**When to enable:** If you use daily notes format

#### Performance Profiling

**Status:** Disabled by default
**Description:** Enable performance monitoring for critical operations

**When to enable:** 
- Troubleshooting slow performance
- Development and testing

**Note:** Adds minimal overhead when enabled

#### Incremental Task Index

**Status:** Enabled by default
**Requires restart:** Yes
**Description:** Use incremental indexing for better performance

**Benefits:**
- Faster updates
- Lower memory usage
- Better performance with 10k+ tasks

---

## Advanced Settings

### Data Storage

#### Storage Format

**Options:**
- JSON (default) - Human-readable, easier debugging
- MessagePack - Faster, smaller files

#### Backup Settings

**Automatic backups:**
- Before each migration
- Daily (if enabled)
- On manual request

**Backup retention:** 7 days (default)

### Migration

#### Auto-migrate on Load

**Enabled:** Plugin automatically migrates old data formats
**Disabled:** Manual migration required

**Recommendation:** Keep enabled

#### Show Migration Summary

**Enabled:** Display notification after migration
**Disabled:** Silent migration

**Example notification:**
```
✅ Migration Complete
Migrated 247 tasks from v3 to v4
Backup saved: recurring-tasks-active-backup-v3-2025-01-20
```

### Developer Options

#### Enable Debug Logging

**Enabled:** Detailed logs in console
**Disabled:** Info and error logs only

**Use when:** Troubleshooting issues

#### Performance Metrics

**Enabled:** Log performance stats for operations
**Disabled:** No performance tracking

**Example output:**
```
[Performance] loadActiveTasks: 234ms
[Performance] rebuildIndex: 567ms
[Performance] queryEngine.execute: 12ms
```

---

## Troubleshooting Settings

### Plugin is slow with many tasks

1. Enable "Incremental Task Index"
2. Set "Index Refresh Mode" to "Debounced"
3. Configure "Scoped Notebooks" to limit indexing
4. Set "Max Tasks to Load" to 5000

### Tasks not appearing

1. Check "Global Filter" settings
2. Verify tag patterns match your tasks
3. Try "Exclude mode" instead of "Include mode"
4. Manually refresh the index

### Migration failed

1. Check for backup file in plugin data
2. Disable "Auto-migrate on Load"
3. Report issue with error message
4. Restore from backup if needed

---

## Best Practices

### For Small Workspaces (< 500 tasks)

- Use default settings
- Enable all feature flags
- Realtime index refresh
- No scoped notebooks needed

### For Medium Workspaces (500-2000 tasks)

- Switch to "Debounced" index refresh
- Consider scoped notebooks
- Review feature flags, disable unused features
- Enable daily backups

### For Large Workspaces (2000+ tasks)

- Enable "Incremental Task Index"
- Use "Debounced" or "Manual" refresh
- Configure scoped notebooks
- Set max tasks limit
- Use exclude mode for global filter
- Disable performance profiling

---

## Configuration Example

### Recommended settings for project management:

```yaml
Global Filter:
  Mode: Include
  Pattern: #task|#project

Task Format: Emoji

Status Definitions: Default

Performance:
  Index Refresh: Debounced
  Scoped Notebooks: [/projects, /work]
  Max Tasks: 5000

Feature Flags:
  - Emoji Format: ✅
  - Dependencies: ✅
  - Query Language: ✅
  - Filename Date: ❌
  - Performance Profiling: ❌
  - Incremental Index: ✅
```

---

## See Also

- [Task Format Reference](./task-format-reference.md) - Complete syntax guide
- [Query Examples](./query-examples.md) - Query patterns and examples
- [Migration Guide](./migration-guide.md) - Upgrading from older versions
