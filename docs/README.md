# SiYuan Task Management Plugin - User Guide

## Overview

The **SiYuan Task Management Plugin** brings powerful task management capabilities to SiYuan, with support for:

- ✅ Rich task metadata (dates, priorities, tags, dependencies)
- 🔁 Recurring tasks with flexible scheduling
- 🎯 Advanced query language for filtering and sorting
- 📊 Dependency tracking with circular detection
- 🏷️ Hierarchical tag support
- ⚡ High performance (handles 10k+ tasks)
- 📅 Natural language date parsing

## Quick Start

### Creating a Task

Tasks are created using standard checkbox syntax:

```markdown
- [ ] Buy groceries 📅 2026-02-10 ⏫ #errands
```

**Key components:**
- `- [ ]` - Checkbox (creates the task)
- Task description
- `📅 2026-02-10` - Due date
- `⏫` - Priority (high)
- `#errands` - Tags

### Task Metadata

#### Dates

| Symbol | Field | Example | Meaning |
|--------|-------|---------|---------|
| 📅 | Due | `📅 2026-02-10` | Task must be completed by this date |
| ⏳ | Scheduled | `⏳ 2026-02-08` | Planned work date |
| 🛫 | Start | `🛫 2026-02-06` | Earliest date to begin |
| ➕ | Created | `➕ 2026-02-01` | When task was created |
| ✅ | Done | `✅ 2026-02-05` | When task was completed |
| ❌ | Cancelled | `❌ 2026-02-04` | When task was cancelled |

**Natural Language Dates:**
- `today`, `tomorrow`, `yesterday`
- `next Monday`, `last Friday`
- `in 3 days`, `2 weeks ago`
- `+7d` (7 days from now), `-2w` (2 weeks ago)

#### Priority

| Symbol | Priority | Weight |
|--------|----------|--------|
| 🔺 | Highest | 1 |
| ⏫ | High | 2 |
| 🔼 | Medium | 3 |
| (none) | Normal | 4 |
| 🔽 | Low | 5 |
| ⏬ | Lowest | 6 |

#### Tags

Tags can be hierarchical using `/` separator:

```markdown
- [ ] Client meeting #project/client-alpha #context/work
```

**Hierarchical Matching:**
- Query `tag includes #project` matches `#project/client-alpha`
- Query `tag includes #project/client-alpha` does NOT match `#project`

#### Recurrence

Create repeating tasks using the recurrence emoji:

```markdown
- [ ] Daily standup 🔁 every day 📅 2026-02-06
- [ ] Weekly review 🔁 every Monday ⏳ 2026-02-10
- [ ] Monthly report 🔁 every month on the 1st 📅 2026-03-01
```

**Supported Patterns:**
- `every day` / `daily`
- `every week` / `weekly`
- `every 2 weeks` / `biweekly`
- `every month` / `monthly`
- `every Monday` (specific weekday)
- `every weekday` (Mon-Fri)
- `every 3rd Friday` (nth weekday of month)

**Recurrence Modes:**
- **Strict:** Next due = last due + interval  
  Example: Due every Monday → always Monday
- **Relative:** Next due = completion date + interval  
  Example: Complete Tuesday → next due next Tuesday

#### Dependencies

Tasks can depend on other tasks using IDs:

```markdown
- [ ] Design mockups 🆔 design-mockups
- [ ] Build frontend ⛔ design-mockups
```

**Dependency Operators:**
- `🆔 task-id` - Assign unique ID to task
- `⛔ task-id` - This task depends on another

**Circular Dependency Protection:**
If A → B → C → A, the plugin will:
- Detect the cycle
- Show error: "Circular dependency detected: A → B → C → A"
- Refuse to save the dependency

#### Status

Customize checkbox symbols for different states:

| Symbol | Name | Type | Meaning |
|--------|------|------|---------|
| ` ` | To Do | TODO | Not started |
| `x` | Done | DONE | Completed |
| `/` | In Progress | IN_PROGRESS | Actively working |
| `-` | Cancelled | CANCELLED | Won't do |
| `>` | Forwarded | TODO | Delegated |
| `!` | Important | TODO | Urgent |

**Toggle Behavior:**
- Click checkbox → cycles through states
- Completing a task (`[x]`) → adds done date
- Cancelling a task (`[-]`) → adds cancelled date

## Query Language

### Basic Queries

**Filter by status:**
```
not done
done
cancelled
```

**Filter by dates:**
```
due today
due before today
due after 2026-02-10
scheduled before 2026-02-15
```

**Filter by metadata:**
```
has due date
no due date
has recurrence
priority is high
```

**Filter by tags:**
```
tag includes #work
tag includes #project/alpha
```

**Filter by path:**
```
path includes daily/
path matches .*meeting.*
```

**Filter by dependencies:**
```
is blocked
is not blocked
is blocking
depends on task-abc123
```

### Advanced Queries

**Logical operators:**
```
(not done) AND (due before today)
priority is high OR tag includes #urgent
not done AND not (tag includes #archived)
```

**Sorting:**
```
not done sort by due asc
tag includes #work sort by priority desc
due today sort by priority desc, due asc
```

**Grouping:**
```
not done group by status
tag includes #work group by priority
```

### Query Examples Library

**Today's tasks:**
```
(due today OR scheduled today) AND not done
```

**Overdue tasks:**
```
due before today AND not done
```

**Available tasks (not blocked):**
```
not done AND is not blocked
```

**High priority work tasks:**
```
not done AND priority is high AND tag includes #work
```

**This week's tasks:**
```
due after today AND due before +7d
```

**Tasks by project:**
```
tag includes #project group by tag
```

**Completed today:**
```
done AND done.date is today
```

## Plugin Interface

### Dock Panel

The task dashboard appears in SiYuan's right sidebar with 5 tabs:

1. **📥 Inbox** - All open tasks
2. **📅 Today** - Due or scheduled today
3. **📆 Upcoming** - Due in next 7 days
4. **✅ Done** - Recently completed
5. **🏷️ Projects** - Grouped by tag

**Features:**
- Search bar with query language
- Quick filters (status, tag, date)
- Sort controls (due, priority, created)
- Group controls (status, tag, date)

### Edit Modal

**Open with:**
- Command: "Edit Task"
- Keyboard: `Ctrl+Shift+T`
- Click task description in dock panel

**Fields:**
- Description (with Markdown preview)
- Due date (natural language supported)
- Scheduled date
- Start date
- Priority (dropdown)
- Status (dropdown)
- Tags (with autocomplete)
- Recurrence (with rule autocomplete)
- ID (auto-generated)
- Dependencies (multi-select)
- On Completion (keep/delete)

### Keyboard Shortcuts

| Command | Shortcut | Action |
|---------|----------|--------|
| Toggle Status | `Ctrl+Enter` | Cycle to next status |
| Mark Done | `Ctrl+Shift+X` | Complete task |
| Edit Task | `Ctrl+Shift+T` | Open edit modal |
| Quick Add | `Ctrl+Shift+N` | New task modal |
| Insert Due Date | `Ctrl+Shift+D` | Date picker |
| Insert Priority | `Ctrl+Shift+P` | Priority selector |

## Settings

### Task Format

- **Emoji Mode:** Use emoji signifiers (📅, ⏫, etc.)
- **Text Mode:** Use text signifiers (`due:`, `priority:`, etc.)
- **Both:** Support both formats

### Global Filter

Control which checklist items are treated as tasks:

- **No filter:** All checkboxes are tasks
- **Tag filter:** Only checkboxes with specific tag (e.g., `#task`)
- **Path filter:** Only in specific notebooks/folders
- **Custom regex:** Advanced filtering

### Date Tracking

- **Auto-add created date:** ✅ Recommended
- **Auto-add done date:** ✅ Recommended
- **Auto-add cancelled date:** ✅ Recommended

### Recurring Behavior

- **New task placement:** Above or below original
- **Date carry mode:** Strict or relative
- **Remove scheduled date:** On recurrence generation

### Performance

- **Index refresh:** Debounced (1000ms default)
- **Scope folders:** Index only specific notebooks
- **Max tasks:** Safety limit (10,000 default)
- **Enable history partitioning:** ✅ Recommended

## Migration Guide

### From Old Plugin Version

The plugin automatically migrates old task formats:

**Old format:**
```markdown
- [✓] Task @due(2026-02-06) !high @tag(work)
```

**New format:**
```markdown
- [x] Task 📅 2026-02-06 ⏫ #work
```

**Migration process:**
1. Plugin detects old format on startup
2. Creates backup of current data
3. Migrates task lines to new format
4. Updates settings to new schema
5. Saves migrated data

**Rollback:**
If migration fails, backups are stored in:
- Location: Plugin data directory
- Format: `backup-v1-to-v2-[timestamp].json`
- Retention: 5 most recent backups

### Manual Migration

To manually migrate a task line:

1. Open task in edit modal
2. Plugin auto-converts to new format
3. Save to apply changes

## Performance & Scalability

### Benchmarks

The plugin is optimized for large task lists:

| Operation | Target | Typical |
|-----------|--------|---------|
| Index 10k tasks | < 5s | ~2s |
| Simple query | < 100ms | ~30ms |
| Complex query | < 100ms | ~50ms |
| Sort 10k tasks | < 200ms | ~80ms |
| Index update | < 50ms | ~20ms |

### Memory Usage

- **10k tasks:** ~50MB memory
- **History storage:** Time-partitioned (12 months retained)
- **Cache:** Auto-unload old partitions

### Optimization Tips

1. **Enable folder scoping:** Index only active notebooks
2. **Use partitioned history:** Prevents unbounded growth
3. **Archive old tasks:** Export completed tasks annually
4. **Use specific queries:** More filters = faster results

## Troubleshooting

### Tasks not appearing in dashboard

**Check:**
- Global filter settings (may be excluding tasks)
- Notebook scope (task might be in excluded folder)
- Task format (ensure proper checkbox syntax)

**Solution:**
1. Settings → Global Filter → Disable
2. Settings → Scope Folders → Add notebook
3. Verify task has `- [ ]` at start of line

### Slow performance

**Check:**
- Number of indexed tasks
- History partition count
- Query complexity

**Solution:**
1. Settings → Scope Folders → Limit to active notebooks
2. Settings → Max Tasks → Reduce if > 10k
3. Enable partitioned history storage
4. Archive old completed tasks

### Query not returning expected results

**Check:**
- Query syntax (use query builder)
- Tag hierarchy (parent/child matching)
- Dependency state (task might be blocked)

**Solution:**
1. Test simple query first: `not done`
2. Add one filter at a time
3. Check task metadata in edit modal
4. Verify tags match exactly (case-sensitive)

### Circular dependency error

**Cause:**
Task dependency creates a cycle: A → B → C → A

**Solution:**
1. Review dependency chain in error message
2. Remove one dependency to break cycle
3. Consider if dependencies are correct
4. Use dependency graph view (if available)

## FAQ

**Q: Can I use both emoji and text formats?**  
A: Yes! Enable "Both" in Task Format settings.

**Q: How do I delete completed tasks?**  
A: Use `onComplete: delete` or the 🏁 delete emoji.

**Q: Do recurring tasks work with dependencies?**  
A: Yes, but dependencies are copied to new instances.

**Q: Can I export my tasks?**  
A: Tasks are stored as plain text in your documents. You can also export history partitions as JSON.

**Q: How do I backup my tasks?**  
A: Tasks are in your SiYuan documents (backed up by SiYuan). Plugin settings are auto-backed up before migration.

**Q: What happens if two tasks have the same ID?**  
A: Plugin detects duplicates and suggests regeneration.

**Q: Can I customize keyboard shortcuts?**  
A: Currently using default shortcuts. Custom keybindings coming in future update.

## Support

- **Documentation:** [docs/](../docs/)
- **GitHub Issues:** [github.com/Drmusab/task-recurring-notification-management](https://github.com/Drmusab/task-recurring-notification-management)
- **Discussions:** GitHub Discussions tab

## Version History

### v2.0.0 (Current)
- ✨ Advanced query language
- ✨ Task dependencies with cycle detection
- ✨ Hierarchical tags
- ✨ Time-partitioned history storage
- ✨ Performance optimization (10k+ tasks)
- ✨ Migration from v1.x

### v1.0.0
- Initial release with basic task management
- Recurring tasks
- Date tracking
- Priority and tags
