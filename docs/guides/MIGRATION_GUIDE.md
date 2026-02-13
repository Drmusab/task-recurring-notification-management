# Migration Guide

Complete guide for migrating from plugin v1.x to v2.0.

## Overview

Version 2.0 introduces significant improvements:

- ✨ Enhanced task metadata
- 🔁 Advanced recurrence engine
- 🎯 Query language
- 📊 Dependency tracking
- ⚡ Performance optimization (10k+ tasks)

**Migration is automatic** but this guide helps you understand the changes.

## Before You Migrate

### 1. Backup Your Data

**Automatic backup:**
- Plugin creates backup before migration
- Location: Plugin data directory
- Format: `backup-v1-to-v2-[timestamp].json`

**Manual backup (recommended):**
1. Export your SiYuan workspace
2. Copy `.siyuan/data/` folder
3. Note: Tasks live in your documents (Markdown files)

### 2. Check Compatibility

**Requirements:**
- SiYuan version ≥ 3.0.0
- Plugin v1.0.0 or newer

**Known issues:**
- None currently reported

### 3. Plan Downtime

**Migration time estimates:**
- < 100 tasks: < 1 second
- 1,000 tasks: ~5 seconds
- 10,000 tasks: ~30 seconds

## Migration Process

### Automatic Migration

**On plugin upgrade:**

1. **Detection**
   - Plugin detects v1.x data format
   - Shows migration prompt

2. **Backup**
   - Creates automatic backup
   - Saves current settings

3. **Data Migration**
   - Converts task metadata format
   - Updates settings schema
   - Migrates storage structure

4. **Validation**
   - Verifies task count preserved
   - Checks for data loss
   - Reports any warnings

5. **Completion**
   - Shows migration summary
   - Lists any issues
   - Plugin ready to use

### Manual Migration

If auto-migration fails or you want control:

1. **Settings → Migration**
2. Click "Migrate from v1.x"
3. Review migration plan
4. Confirm migration
5. Wait for completion

## What Changes

### Task Line Format

**Old format (v1.x):**
```markdown
- [✓] Task @due(2026-02-06) !high @tag(work) @repeat(daily)
```

**New format (v2.0):**
```markdown
- [x] Task 📅 2026-02-06 ⏫ #work 🔁 daily
```

**Changes:**
| Old | New | Notes |
|-----|-----|-------|
| `[✓]` | `[x]` | Standard done symbol |
| `@due(date)` | `📅 date` | Emoji format (configurable) |
| `!high` | `⏫` | Priority emoji |
| `@tag(name)` | `#name` | Standard hashtags |
| `@repeat(rule)` | `🔁 rule` | Recurrence emoji |

### Priority Mapping

**Old (numeric):**
```
1 = Highest
2 = High
3 = Medium  
4 = Low
5 = Lowest
```

**New (names):**
```
highest 🔺
high ⏫
medium 🔼
low 🔽
lowest ⏬
```

### Dates

**Old (Unix timestamps):**
```json
{
  "created": 1643673600000,
  "completed": 1643760000000
}
```

**New (ISO strings):**
```json
{
  "createdAt": "2022-02-01T00:00:00.000Z",
  "doneAt": "2022-02-02T00:00:00.000Z"
}
```

### Settings

**Added settings (v2.0):**
- Global query filter
- Custom status definitions
- Dependency settings
- Performance options
- History partitioning

**Removed settings:**
- Legacy notification format
- Old recurrence engine options

## After Migration

### 1. Verify Your Tasks

**Check task count:**
```
Settings → Statistics
```

Expected: Same number of tasks as before.

**Spot check tasks:**
- Open several documents
- Verify tasks still present
- Check metadata intact

### 2. Test Core Features

**Test checklist:**
- [ ] Toggle task status (checkbox)
- [ ] Edit task metadata (modal)
- [ ] Filter tasks (query)
- [ ] Complete recurring task
- [ ] Create new task

### 3. Review Settings

**Recommended settings:**

```yaml
Format: Emoji (or Both for compatibility)
Global Filter: Disabled (unless needed)
Auto-dates:
  - Created: Yes
  - Done: Yes
  - Cancelled: Yes
Recurrence:
  - Placement: Below original
  - Mode: Strict
Performance:
  - History partitioning: Enabled
  - Scope folders: (your active notebooks)
```

### 4. Update Workflows

**If you used custom scripts:**
- Update to new task format
- Use new query language
- Check API changes (if any)

**If you had saved searches:**
- Recreate using new query language
- More powerful filtering available

## Rollback Procedure

### If Migration Fails

**Automatic rollback:**
1. Migration failure detected
2. Restore from automatic backup
3. Show error report
4. Plugin remains at v1.x

**Manual rollback:**

1. **Disable v2.0 plugin**
   ```
   Settings → Installed Plugins → Task Management → Disable
   ```

2. **Restore backup**
   ```
   Settings → Migration → Restore Backup
   Select: backup-v1-to-v2-[timestamp].json
   ```

3. **Reinstall v1.x**
   - Download v1.x from releases
   - Install manually
   - Reboot SiYuan

4. **Verify restoration**
   - Check task count
   - Test core features
   - Review tasks

### Report Issues

If you need to rollback:

1. **Export logs**
   ```
   Settings → Advanced → Export Logs
   ```

2. **Create issue**
   - GitHub: [github.com/Drmusab/task-recurring-notification-management/issues](https://github.com/Drmusab/task-recurring-notification-management/issues)
   - Include: Error logs, task count, SiYuan version
   - Attach: Migration report (if available)

3. **Stay on v1.x**
   - Wait for fix in v2.0.1
   - Or stay on v1.x (still supported)

## Troubleshooting

### Issue: Task count mismatch

**Symptoms:**
- Migration reports X tasks
- You expected Y tasks

**Causes:**
- Global filter (v2.0) may be excluding tasks
- Some tasks may not match old format

**Solution:**
```
1. Settings → Global Filter → Disable
2. Refresh task view
3. Check if count matches now
4. If not, check migration warnings
```

### Issue: Task metadata lost

**Symptoms:**
- Due dates missing
- Priorities reset
- Tags disappeared

**Causes:**
- Non-standard task format in v1.x
- Manual text editing

**Solution:**
```
1. Check migration warnings
2. Review original document
3. Manually re-add metadata if needed
4. Use edit modal (auto-formats)
```

### Issue: Recurring tasks broken

**Symptoms:**
- Recurrence not triggering
- Next instance not generated

**Causes:**
- Recurrence rule format changed
- Need to update rule syntax

**Solution:**
```
1. Open task in edit modal
2. Re-enter recurrence rule using new syntax
3. Examples:
   - Old: @repeat(daily)  
   - New: 🔁 daily
4. Save task
```

### Issue: Performance degraded

**Symptoms:**
- Slow loading
- Laggy UI
- High memory usage

**Causes:**
- History not partitioned
- Too many tasks indexed
- No scope filtering

**Solution:**
```
1. Settings → Performance
2. Enable history partitioning
3. Set scope folders (index only active notebooks)
4. Set max tasks (10,000 recommended)
5. Restart plugin
```

### Issue: Dependencies not working

**Symptoms:**
- "Is blocked" query shows nothing
- Circular dependency not detected

**Causes:**
- Task IDs not assigned
- Dependencies using old format

**Solution:**
```
1. Open task in edit modal
2. Assign task ID: 🆔 unique-id
3. Set dependency: ⛔ other-task-id
4. Save task
5. Rebuild index: Settings → Advanced → Rebuild Index
```

## FAQ

**Q: Will my documents be modified?**  
A: Yes, task lines will be updated to new format. BUT: SiYuan has version history, you can undo.

**Q: Can I keep using old format?**  
A: Temporarily, yes (with "Both" format setting). Long-term: migrate to new format for best experience.

**Q: Will v1.x still be supported?**  
A: Security updates only. New features in v2.x only.

**Q: How long will migration backups be kept?**  
A: Default: 5 most recent backups. Older backups auto-deleted.

**Q: Can I migrate only some tasks?**  
A: No, migration is all-or-nothing. But you can manually convert task-by-task using edit modal.

**Q: What if I have custom checkbox symbols?**  
A: Define them in Settings → Custom Status. Migration attempts to preserve custom symbols.

**Q: Will my keyboard shortcuts change?**  
A: Some shortcuts added, none removed. Check Settings → Shortcuts for updates.

**Q: Do I need to retrain muscle memory?**  
A: Mostly no. Core interactions (toggle, edit, query) similar. New features additive.

## Migration Checklist

Use this checklist to ensure smooth migration:

**Pre-Migration:**
- [ ] Backup SiYuan workspace
- [ ] Note current task count
- [ ] Export plugin settings (optional)
- [ ] Review breaking changes
- [ ] Plan 30 minutes for migration + testing

**Migration:**
- [ ] Upgrade plugin to v2.0
- [ ] Confirm automatic migration prompt
- [ ] Wait for migration to complete
- [ ] Review migration summary
- [ ] Check for errors/warnings

**Post-Migration:**
- [ ] Verify task count matches
- [ ] Spot check 10+ tasks
- [ ] Test toggle status
- [ ] Test edit modal
- [ ] Test query filtering
- [ ] Test recurring task
- [ ] Review settings
- [ ] Update custom workflows (if any)

**Verification:**
- [ ] All tasks present
- [ ] Metadata intact
- [ ] Recurring tasks work
- [ ] Dependencies work
- [ ] Performance acceptable
- [ ] No error messages

## Support Resources

**Documentation:**
- User Guide: [docs/README.md](./README.md)
- Query Reference: [docs/QUERY_REFERENCE.md](./QUERY_REFERENCE.md)

**Community:**
- GitHub Discussions: [github.com/Drmusab/task-recurring-notification-management/discussions](https://github.com/Drmusab/task-recurring-notification-management/discussions)
- Discord: (if available)

**Reporting Issues:**
- GitHub Issues: [github.com/Drmusab/task-recurring-notification-management/issues](https://github.com/Drmusab/task-recurring-notification-management/issues)
- Email: (if provided)

## Version History

### v2.0.0 (Current)
- Complete rewrite
- Query language
- Dependencies
- Performance optimization

### v1.0.0 (Legacy)
- Original release
- Basic task management
- Simple recurrence

---

**Need help?** Open an issue on GitHub or ask in Discussions.
