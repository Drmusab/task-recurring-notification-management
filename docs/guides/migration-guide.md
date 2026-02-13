# Migration Guide

Guide for users upgrading from older versions of the Recurring Task Management plugin.

---

## Overview

The plugin automatically detects and migrates data from older versions. This guide explains what happens during migration and how to handle potential issues.

---

## Automatic Migration

### What Happens

When you upgrade to a new version, the plugin:

1. **Detects Old Format:** Checks the schema version of your data
2. **Creates Backup:** Saves a timestamped backup before any changes
3. **Applies Migrations:** Sequentially updates data through all version changes
4. **Validates Data:** Ensures all tasks are valid after migration
5. **Shows Summary:** Displays a notification with migration results

### Migration Process

```
Old Data (v1) → Backup Created → Migrate v1→v2 → Migrate v2→v3 → Migrate v3→v4 → New Data (v4)
```

### Migration Summary Notification

After successful migration, you'll see:

```
✅ Migration Complete

Migrated 247 tasks from v1 to v4
Backup: recurring-tasks-active-backup-v1-2025-01-20T10-30-00-000Z

All tasks were successfully upgraded with no data loss.
```

---

## Migration Versions

### Version 1 → Version 2

**Added Fields:**
- `timezone` - Timezone for scheduling
- `completionCount` - Number of times completed
- `missCount` - Number of times missed
- `currentStreak` - Current completion streak
- `bestStreak` - Best completion streak
- `recentCompletions` - Recent completion timestamps
- `priority` - Task priority level
- `tags` - Task tags for categorization
- `notificationChannels` - Notification delivery channels
- `snoozeCount` - Number of times snoozed
- `maxSnoozes` - Maximum snooze count

**Default Values:**
- Timezone defaults to system timezone
- Counts default to 0
- Arrays default to empty
- Priority defaults to "normal"

**Impact:** No breaking changes. All existing tasks continue to work.

### Version 2 → Version 3

**Added Fields:**
- `escalationPolicy` - Escalation rules for missed tasks
- `linkedBlockContent` - Cached block content
- `category` - Task category
- `description` - Task description/notes

**Default Values:**
- Escalation policy disabled by default
- Optional fields remain undefined if not set

**Impact:** Adds analytics and escalation features.

### Version 3 → Version 4

**Added Fields:**
- `onCompletion` - What to do when task is completed ("keep" or "delete")
- `dependsOn` - Array of task IDs this task depends on
- `blockedBy` - Array of task IDs blocking this task

**Default Values:**
- `onCompletion` defaults to "keep"
- Dependency arrays default to empty

**Impact:** 
- Enables task dependencies
- Allows cleanup of completed recurring tasks
- No breaking changes for existing tasks

---

## Backup Files

### Location

Backups are stored in the plugin's data directory:

```
/data/storage/petal/plugin-sample-shehab-note/
  ├── recurring-tasks-active.json
  ├── recurring-tasks-active-backup-v1-2025-01-20T10-30-00-000Z.json
  ├── recurring-tasks-active-backup-v2-2025-01-20T11-15-00-000Z.json
  └── recurring-tasks-active-backup-v3-2025-01-20T12-00-00-000Z.json
```

### Backup Naming

Format: `{storage-key}-backup-v{version}-{timestamp}.json`

Example: `recurring-tasks-active-backup-v3-2025-01-20T10-30-00-000Z.json`

- `storage-key`: The data file being backed up
- `version`: Schema version before migration
- `timestamp`: ISO timestamp with special characters replaced

### Backup Retention

- **Default:** Backups are kept indefinitely
- **Recommendation:** Manually delete backups older than 30 days
- **Safety:** Keep at least the most recent backup

---

## Manual Rollback

If you need to restore from a backup:

### Using Plugin Settings

1. Open plugin settings
2. Go to **Advanced** tab
3. Click **Restore from Backup**
4. Select the backup file by timestamp
5. Click **Restore**
6. Restart SiYuan

### Manual Restoration

1. Stop SiYuan
2. Navigate to plugin data directory
3. Backup current `recurring-tasks-active.json`
4. Copy backup file content to `recurring-tasks-active.json`
5. Start SiYuan

**Example:**

```bash
# Navigate to plugin directory
cd /data/storage/petal/plugin-sample-shehab-note/

# Backup current state
cp recurring-tasks-active.json recurring-tasks-active-current.json

# Restore from backup
cp recurring-tasks-active-backup-v3-2025-01-20T10-30-00-000Z.json recurring-tasks-active.json
```

---

## Breaking Changes

### No Breaking Changes in v1-v4

All migrations from v1 through v4 are backward compatible:
- Existing task functionality is preserved
- New fields are added with safe defaults
- No data is removed or restructured

### Future Version Considerations

If future versions introduce breaking changes, this guide will be updated with:
- Clear warning about breaking changes
- Migration steps required
- Potential data loss scenarios
- Recommended backup strategy

---

## Migration Troubleshooting

### Migration Failed Error

**Symptoms:**
```
❌ Migration Failed
Error: Unable to parse task data
```

**Steps:**
1. Check the error details in console (F12)
2. Verify backup was created
3. Report the issue with:
   - Error message
   - Schema version (from backup filename)
   - Number of tasks
4. Restore from backup if needed

### Tasks Missing After Migration

**Symptoms:**
- Some tasks don't appear in the dashboard
- Task count is lower than expected

**Steps:**
1. Check if Global Filter settings changed
2. Verify tasks meet filter criteria
3. Manually refresh task index
4. Check backup file to confirm tasks exist
5. Restore from backup if needed

### Plugin Won't Load After Migration

**Symptoms:**
- Plugin fails to initialize
- Error in SiYuan startup

**Steps:**
1. Open browser console (F12)
2. Note the error message
3. Manually restore from backup:
   ```bash
   cp recurring-tasks-active-backup-*.json recurring-tasks-active.json
   ```
4. Restart SiYuan
5. Report the issue

### Duplicate Tasks After Migration

**Symptoms:**
- Tasks appear twice in the dashboard
- Task count is higher than expected

**Possible Causes:**
- Migration ran multiple times
- Manual and auto-migration conflict

**Steps:**
1. Stop SiYuan
2. Restore from the earliest backup:
   ```bash
   cp recurring-tasks-active-backup-v1-*.json recurring-tasks-active.json
   ```
3. Delete other backups temporarily
4. Restart SiYuan (migration will run once)
5. Verify task count is correct

---

## Best Practices

### Before Upgrading

1. **Manual Backup:** Export your tasks or create a manual backup
2. **Note Task Count:** Record the number of active tasks
3. **Test Environment:** If possible, test in a development environment first
4. **Read Release Notes:** Check for version-specific migration notes

### After Migration

1. **Verify Task Count:** Ensure all tasks are present
2. **Spot Check:** Review a few tasks to confirm data integrity
3. **Test Functionality:** Create and complete a test task
4. **Keep Backup:** Don't delete the migration backup for at least a week

### Regular Maintenance

1. **Weekly Backups:** Create manual backups weekly (if you have critical tasks)
2. **Cleanup:** Archive old completed tasks
3. **Monitor Performance:** Watch for slowdowns as task count grows
4. **Update Regularly:** Stay on recent versions for bug fixes

---

## Data Export

### Manual Export

To create a portable backup:

1. Open plugin settings
2. Go to **Advanced** → **Export Data**
3. Choose format: JSON or CSV
4. Save file to safe location

### Automated Export

Configure scheduled exports:

1. Enable **Automatic Daily Export** in settings
2. Set export location
3. Choose retention policy (7, 14, 30 days)

---

## Migration History Log

The plugin maintains a migration log in the data directory:

**File:** `migration-history.json`

**Example:**
```json
{
  "migrations": [
    {
      "timestamp": "2025-01-20T10:30:00.000Z",
      "fromVersion": 1,
      "toVersion": 4,
      "tasksAffected": 247,
      "backupFile": "recurring-tasks-active-backup-v1-2025-01-20T10-30-00-000Z.json",
      "success": true
    }
  ]
}
```

This log helps diagnose issues and track migration history.

---

## Version-Specific Notes

### Upgrading to v4 (Current)

**New Features:**
- Task dependencies (requires restart)
- On-completion behavior (keep/delete)
- Incremental task indexing

**Migration Time:**
- < 100 tasks: Instant
- 100-1000 tasks: < 1 second
- 1000-5000 tasks: 1-3 seconds
- 5000+ tasks: 3-10 seconds

**Recommendations:**
- Review new dependency features in documentation
- Consider enabling "delete on completion" for recurring tasks
- Test task dependencies with a few sample tasks first

### Upgrading from v1

**Major Changes:**
- Analytics tracking added
- Notification channels introduced
- Escalation policies available
- Task dependencies supported

**After Migration:**
- All analytics start at zero
- Escalation policies are disabled
- Dependencies are empty arrays

---

## Support

### Getting Help

If you encounter migration issues:

1. **Check Documentation:** Review this guide and troubleshooting steps
2. **Search Issues:** Look for similar problems in GitHub issues
3. **Provide Details:** When reporting, include:
   - Schema versions (before/after)
   - Error messages (from console)
   - Number of tasks
   - Backup file details
4. **Backup First:** Always ensure you have a backup before troubleshooting

### Community Resources

- **GitHub Issues:** https://github.com/Drmusab/recurring-task-management/issues
- **Documentation:** https://github.com/Drmusab/recurring-task-management/docs
- **Discord:** (If available)

---

## See Also

- [Task Format Reference](./task-format-reference.md) - New task syntax
- [Settings Guide](./settings-guide.md) - Configure migration behavior
- [Query Examples](./query-examples.md) - Use new query features
