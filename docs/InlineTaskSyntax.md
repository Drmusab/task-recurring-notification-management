# Inline Task Syntax Reference

## Overview

The Inline Task Parser allows you to create and manage tasks directly in markdown using natural syntax with emoji-based metadata tokens. This provides a powerful, readable way to define tasks with rich metadata without leaving your editor.

## Basic Syntax

Every task must start with a markdown checklist item:

```markdown
- [ ] Task description
- [x] Completed task
- [-] Cancelled task
```

### Status Symbols

| Checkbox | Status | Description |
|----------|--------|-------------|
| `- [ ]`  | `todo` | Task is pending |
| `- [x]`  | `done` | Task is completed |
| `- [-]`  | `cancelled` | Task was cancelled |

## Metadata Tokens

Add metadata to your tasks using emoji tokens followed by values.

### Date Tokens

#### Due Date 📅

Set when a task is due:

```markdown
- [ ] Submit report 📅 2026-01-30
- [ ] Call client 📅 tomorrow
- [ ] Review PR 📅 next monday
```

**Supported formats:**
- ISO dates: `YYYY-MM-DD` (e.g., `2026-01-30`)
- Natural language: `today`, `tomorrow`, `yesterday`
- Relative: `next week`, `in 3 days`, `2 weeks ago`
- Named days: `next monday`, `friday`, `last tuesday`

#### Scheduled Date ⏳

When you plan to start working on the task:

```markdown
- [ ] Big project ⏳ next monday 📅 next friday
```

#### Start Date 🛫

The earliest date the task can begin:

```markdown
- [ ] Launch campaign 🛫 2026-02-01 📅 2026-02-15
```

### Recurrence Token 🔁

Make a task repeat automatically:

```markdown
- [ ] Weekly report 🔁 every week
- [ ] Daily standup 🔁 every day
- [ ] Monthly review 🔁 every month when done
```

**Supported patterns:**
- `every day` - Daily recurrence
- `every week` - Weekly recurrence
- `every 2 weeks` - Every two weeks
- `every month` - Monthly recurrence
- `every year` - Yearly recurrence
- `every weekday` - Monday through Friday
- `every weekend` - Saturday and Sunday

**Recurrence modes:**
- Default (scheduled): Next occurrence calculated from scheduled date
- `when done`: Next occurrence calculated from completion date

```markdown
- [ ] Exercise 🔁 every day when done
- [ ] Review metrics 🔁 every week
- [ ] Pay rent 🔁 every month on the 1st
```

### Priority Tokens

Set task priority:

| Emoji | Priority | Description |
|-------|----------|-------------|
| 🔺 | High | Urgent/critical tasks |
| 🔼 | Medium | Important tasks |
| 🔽 | Low | Nice-to-have tasks |

```markdown
- [ ] Fix production bug 🔺
- [ ] Code review 🔼
- [ ] Update docs 🔽
```

### Identification and Dependencies

#### Task ID 🆔

Give tasks unique identifiers:

```markdown
- [ ] Research phase 🆔 research-001
- [ ] Implementation 🆔 impl-001 ⛔ research-001
```

**ID format:** Alphanumeric characters, hyphens, and underscores only.

#### Dependencies ⛔

Specify tasks that must be completed first:

```markdown
- [ ] Final review ⛔ draft-complete,edits-done
- [ ] Deploy 🆔 deploy-v2 ⛔ tests-passed,review-approved
```

**Format:** Comma-separated list of task IDs.

### Tags #️⃣

Categorize and filter tasks:

```markdown
- [ ] Bug fix #bug #urgent #backend
- [ ] Feature request #feature #frontend #low-priority
```

**Tag format:** Alphanumeric characters, hyphens, and underscores only.

## Complete Examples

### Minimal Task
```markdown
- [ ] Buy groceries
```

### Task with Due Date
```markdown
- [ ] Prepare presentation 📅 2026-01-28
```

### Recurring Task
```markdown
- [ ] Weekly team meeting 📅 next monday 🔁 every week
```

### Complex Task (All Features)
```markdown
- [ ] Launch new feature ⏳ tomorrow 🛫 today 📅 2026-02-01 🔁 every sprint when done 🔺 🆔 feature-launch ⛔ testing-complete,docs-updated #project #release #priority
```

This parses to:
- **Description:** "Launch new feature"
- **Scheduled date:** Tomorrow
- **Start date:** Today
- **Due date:** 2026-02-01
- **Recurrence:** Every sprint (when marked done)
- **Priority:** High
- **ID:** feature-launch
- **Dependencies:** testing-complete, docs-updated
- **Tags:** project, release, priority

## Token Order

While the parser accepts tokens in any order, the canonical normalized format is:

```
- [status] <description> <dates> <recurrence> <priority> <id> <deps> <tags>
```

Specifically:
1. Checkbox status
2. Description
3. Due date 📅
4. Scheduled date ⏳
5. Start date 🛫
6. Recurrence 🔁
7. Priority (🔺/🔼/🔽)
8. ID 🆔
9. Dependencies ⛔
10. Tags #

## Natural Language Date Examples

The parser supports many natural language date expressions:

```markdown
- [ ] Task 📅 today
- [ ] Task 📅 tomorrow
- [ ] Task 📅 yesterday
- [ ] Task 📅 next week
- [ ] Task 📅 next monday
- [ ] Task 📅 in 3 days
- [ ] Task 📅 in 2 weeks
- [ ] Task 📅 2 days ago
- [ ] Task 📅 last friday
```

## Recurrence Pattern Examples

```markdown
# Simple intervals
- [ ] Daily task 🔁 every day
- [ ] Weekly task 🔁 every week
- [ ] Bi-weekly task 🔁 every 2 weeks
- [ ] Monthly task 🔁 every month
- [ ] Quarterly task 🔁 every 3 months
- [ ] Yearly task 🔁 every year

# Work patterns
- [ ] Weekday task 🔁 every weekday
- [ ] Weekend chore 🔁 every weekend

# Completion-based
- [ ] Exercise 🔁 every 2 days when done
- [ ] Weekly review 🔁 every week when done
```

## Common Patterns

### Project Management
```markdown
- [ ] Sprint planning 📅 next monday 🔁 every 2 weeks 🔼 #scrum
- [ ] Daily standup 📅 tomorrow 🔁 every weekday 🆔 standup #team
- [ ] Sprint review ⛔ sprint-complete 🔺 #scrum #demo
```

### Personal Tasks
```markdown
- [ ] Morning workout 🔁 every day when done 🔼 #health
- [ ] Weekly grocery shopping 📅 saturday 🔁 every week #chores
- [ ] Pay bills 📅 2026-01-30 🔁 every month 🔺 #finance
```

### Work Tasks
```markdown
- [ ] Code review 📅 today 🔼 #dev #review
- [ ] Deploy to production 🆔 deploy-123 ⛔ tests-pass,review-done 🔺 #deploy
- [ ] Update documentation 📅 tomorrow 🔽 #docs
```

## Error Handling

The parser provides helpful error messages:

```markdown
# Invalid date
- [ ] Task 📅 notadate
→ Error: Invalid due date: Could not parse date: notadate

# Invalid recurrence
- [ ] Task 🔁 invalid pattern
→ Error: Invalid recurrence: Recurrence must start with 'every'

# Missing checklist format
Just a regular line
→ Error: Not a checklist item: must start with "- [ ]", "- [x]", or "- [-]"
```

## Edge Cases and Special Behaviors

### Empty Description
Tasks can have metadata without description:
```markdown
- [ ] 📅 2026-01-30 🔼 #urgent
```

### Multiple Priority Tokens
If multiple priority tokens are present, the last one wins:
```markdown
- [ ] Task 🔺 🔼 🔽
→ Priority: low (last token)
```

### Duplicate Metadata Tokens
The validation warns about duplicates but parsing still works:
```markdown
- [ ] Task 📅 2026-01-25 📅 2026-01-26
→ Warning: Multiple due date tokens found
```

### Special Characters in Description
Non-metadata emojis and special characters are preserved:
```markdown
- [ ] Send birthday card 🎂 to @John 📅 tomorrow
→ Description: "Send birthday card 🎂 to @John"
```

### Whitespace
Extra whitespace is trimmed:
```markdown
-   [  ]   Task   📅   2026-01-25
→ Normalized: "- [ ] Task 📅 2026-01-25"
```

## Performance

- Single line parsing: **< 5ms** per line
- Suitable for real-time parsing during typing
- No blocking operations

## Best Practices

1. **Use natural dates for flexibility:**
   ```markdown
   ✅ - [ ] Review PR 📅 tomorrow
   ⚠️ - [ ] Review PR 📅 2026-01-24
   ```

2. **Tag consistently:**
   ```markdown
   - [ ] Task #work #urgent
   - [ ] Another #work #urgent
   ```

3. **Use IDs for dependencies:**
   ```markdown
   - [ ] Phase 1 🆔 phase1
   - [ ] Phase 2 🆔 phase2 ⛔ phase1
   ```

4. **Keep descriptions concise:**
   ```markdown
   ✅ - [ ] Fix login bug 🔺 #bug
   ⚠️ - [ ] Fix the bug where users can't log in when they have special characters in their password 🔺 #bug
   ```

5. **Use recurrence for repeating tasks:**
   ```markdown
   ✅ - [ ] Weekly report 🔁 every week
   ❌ Creating separate tasks each week manually
   ```

## Troubleshooting

### Date Not Parsing
```markdown
# Issue
- [ ] Task 📅 nxt week
→ Error: Invalid due date

# Fix
- [ ] Task 📅 next week
```

### Recurrence Not Working
```markdown
# Issue
- [ ] Task 🔁 weekly
→ Error: Invalid recurrence

# Fix
- [ ] Task 🔁 every week
```

### Tags Not Recognized
```markdown
# Issue
- [ ] Task #my tag
→ Only captures "my", not "my tag"

# Fix
- [ ] Task #my-tag
```

### Dependencies Not Found
```markdown
# Issue
- [ ] Task ⛔ task 1, task 2
→ Only captures "task"

# Fix
- [ ] Task ⛔ task-1,task-2
```

## Integration with Phase 2+

This syntax is the foundation for:
- **Phase 2:** Command integration (`create-task-from-block`)
- **Phase 3:** UI/Modal auto-fill from parsed tasks
- **Phase 4:** Auto-normalization on save and inline checkbox toggling
- **Phase 5:** Task storage and management

The parser is designed to be:
- ✅ **Lossless:** Round-trip parsing preserves all data
- ✅ **Extensible:** Easy to add new tokens
- ✅ **Fast:** Real-time parsing capable
- ✅ **Robust:** Comprehensive error handling

## Inline Task Toggling (Phase 4)

### Overview

When you click a checkbox on a managed task (a task tracked by the plugin), the plugin automatically:
1. Updates the task status
2. Handles recurrence generation (if applicable)
3. Normalizes the block content
4. Tracks completion history

### Behavior

#### Non-Recurring Tasks

**Checking the checkbox (todo → done):**
```markdown
Before: - [ ] Review code
After:  - [x] Review code
```
- Task status updates to `done`
- Completion timestamp is recorded
- Task remains in storage

**Unchecking the checkbox (done → todo):**
```markdown
Before: - [x] Review code
After:  - [ ] Review code
```
- Task status reverts to `todo`
- Completion timestamp is cleared

#### Recurring Tasks

**Checking the checkbox (completing instance):**
```markdown
Before: - [ ] Weekly report 🔁 every week 📅 2026-01-25
After:  - [x] Weekly report 🔁 every week 📅 2026-01-25
(New:   - [ ] Weekly report 🔁 every week 📅 2026-02-01)
```
- Current task marked done
- Next instance automatically created with calculated due date
- Next instance placed above/below based on settings
- Completion tracked in history

**Unchecking a completed recurring task:**
```markdown
Before: - [x] Daily standup 🔁 every day
After:  - [ ] Daily standup 🔁 every day
```
- Task status reverts to `todo`
- Does NOT affect next instance (if already created)

### Status Cycle

The toggle follows this logic:

**When checkbox is checked:**
- `todo` → `done`
- `cancelled` → `done`
- `done` → (no change)

**When checkbox is unchecked:**
- `done` → `todo`
- `cancelled` → `todo`
- `todo` → (no change)

### Settings

Control toggle behavior through Settings:

**Enable inline checkbox toggle** (Default: ON)
- Enables/disables checkbox click handling
- When disabled, checkboxes work as regular markdown

**Update block content after toggle** (Default: ON)
- Automatically normalizes task content after status change
- Ensures consistent formatting

**Show toggle notifications** (Default: OFF)
- Display toast notifications for toggle actions
- Useful for debugging or confirmation

### Non-Managed Checklists

Regular checklists (not tracked by the plugin) are **not affected** by toggle handling:

```markdown
- [ ] Regular checklist item
- [ ] Another regular item
```

These work as normal markdown checkboxes. Only tasks that have been explicitly created through the plugin are managed.

### Performance

- Toggle detection: **< 10ms**
- Status update: **< 100ms**
- Recurrence generation: **< 500ms**
- Uses debouncing to handle rapid clicks

### Error Handling

The toggle handler gracefully handles:
- **Missing block content:** Ignored, no changes made
- **Invalid task format:** Logged, task remains unchanged
- **Concurrent toggles:** Debounced to last action
- **Network issues:** Falls back to local state

Errors are logged and never crash the UI.

### Examples

#### Simple Task Toggle
```markdown
# Initial state
- [ ] Buy groceries 📅 tomorrow

# After clicking checkbox
- [x] Buy groceries 📅 tomorrow
# Status: done, completion recorded
```

#### Recurring Task Toggle
```markdown
# Initial state
- [ ] Weekly review 🔁 every week 📅 2026-01-27

# After clicking checkbox
- [x] Weekly review 🔁 every week 📅 2026-01-27
# New instance created:
- [ ] Weekly review 🔁 every week 📅 2026-02-03
```

#### Toggle with Dependencies
```markdown
# Task with dependencies
- [ ] Final review 🆔 final ⛔ draft-done,tests-pass

# After clicking checkbox
- [x] Final review 🆔 final ⛔ draft-done,tests-pass
# Dependent tasks are notified
```

### Best Practices

1. **Use toggle for quick status updates:**
   - Click checkbox for instant completion
   - Use commands for bulk operations

2. **Let recurrence work automatically:**
   - Just complete the current instance
   - Next instance is created for you

3. **Don't manually edit status symbols:**
   - Use checkbox clicks instead
   - Ensures proper tracking

4. **Monitor completion history:**
   - View in task editor or dashboard
   - Track your completion patterns

### Troubleshooting

**Checkbox doesn't update task:**
- Verify task is managed (created through plugin)
- Check if "Enable inline checkbox toggle" is ON
- Look for error messages in console

**Recurrence not generating:**
- Ensure task has valid recurrence rule
- Check if task has required dates
- Verify recurrence engine is initialized

**Multiple tasks updating:**
- This shouldn't happen - report as bug
- Each checkbox is isolated to its block

## API Reference

See `src/parser/InlineTaskParser.ts` for the complete API documentation.

### Functions

- `parseInlineTask(text: string): ParseResult`
- `normalizeTask(task: ParsedTask): string`
- `validateSyntax(text: string): ValidationResult`

### Types

- `ParsedTask` - Structured task data
- `ParseError` - Error with message and position
- `TaskStatus` - 'todo' | 'done' | 'cancelled'
- `TaskPriority` - 'high' | 'medium' | 'low'
