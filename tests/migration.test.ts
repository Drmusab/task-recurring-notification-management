/**
 * Migration Tests - Test data migration from old to new format
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { 
  Migrator, 
  V1ToV2Migration,
  type LegacyTask,
  type MigrationResult,
  MigrationVersion 
} from '../src/migration/Migrator';

describe('Migration System', () => {
  let migrator: Migrator;

  beforeEach(() => {
    migrator = new Migrator();
  });

  describe('Version Detection', () => {
    it('should detect V1 legacy format', () => {
      const legacyData = {
        tasks: [
          {
            id: '1',
            content: 'Legacy task',
            done: false,
            created: Date.now(),
          },
        ],
      };

      const version = migrator.detectVersion(legacyData);
      expect(version).toBe(MigrationVersion.V1_LEGACY);
    });

    it('should detect V2 format', () => {
      const v2Data = {
        version: MigrationVersion.V2_ENHANCED,
        tasks: [],
      };

      const version = migrator.detectVersion(v2Data);
      expect(version).toBe(MigrationVersion.V2_ENHANCED);
    });

    it('should default to current version for unknown format', () => {
      const unknownData = { foo: 'bar' };
      const version = migrator.detectVersion(unknownData);
      expect(version).toBe(MigrationVersion.V2_ENHANCED);
    });
  });

  describe('Task Line Migration', () => {
    it('should migrate old checkbox format [✓] to [x]', () => {
      const oldLine = '- [✓] Completed task';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toBe('- [x] Completed task');
    });

    it('should migrate old date format @due(2026-02-06) to emoji', () => {
      const oldLine = '- [ ] Task @due(2026-02-06)';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toBe('- [ ] Task 📅 2026-02-06');
    });

    it('should migrate old priority !high to emoji', () => {
      const oldLine = '- [ ] Important task !high';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toBe('- [ ] Important task ⏫');
    });

    it('should migrate old recurrence @repeat(daily) to emoji', () => {
      const oldLine = '- [ ] Daily standup @repeat(daily)';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toBe('- [ ] Daily standup 🔁 daily');
    });

    it('should migrate old tags @tag(work) to hashtags', () => {
      const oldLine = '- [ ] Work task @tag(work)';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toBe('- [ ] Work task #work');
    });

    it('should handle multiple migrations in one line', () => {
      const oldLine = '- [✓] Task @due(2026-02-06) !high @tag(work)';
      const newLine = migrator.migrateTaskLine(oldLine);
      expect(newLine).toContain('[x]');
      expect(newLine).toContain('📅 2026-02-06');
      expect(newLine).toContain('⏫');
      expect(newLine).toContain('#work');
    });

    it('should not modify already-migrated lines', () => {
      const modernLine = '- [x] Task 📅 2026-02-06 ⏫ #work';
      const result = migrator.migrateTaskLine(modernLine);
      expect(result).toBe(modernLine);
    });
  });

  describe('Batch Task Line Migration', () => {
    it('should migrate multiple task lines', () => {
      const lines = [
        '- [ ] Task 1 @due(2026-02-06)',
        '- [✓] Task 2 !high',
        '- [ ] Task 3 @tag(work)',
      ];

      const results = migrator.migrateTaskLines(lines);

      expect(results.length).toBe(3);
      expect(results[0].changed).toBe(true);
      expect(results[1].changed).toBe(true);
      expect(results[2].changed).toBe(true);
    });

    it('should track which lines changed', () => {
      const lines = [
        '- [ ] Modern task 📅 2026-02-06',
        '- [ ] Old task @due(2026-02-06)',
      ];

      const results = migrator.migrateTaskLines(lines);

      expect(results[0].changed).toBe(false);
      expect(results[1].changed).toBe(true);
    });
  });

  describe('V1 to V2 Migration', () => {
    let migration: V1ToV2Migration;

    beforeEach(() => {
      migration = new V1ToV2Migration();
    });

    it('should migrate legacy task format', async () => {
      const legacyData = {
        tasks: [
          {
            id: 'task1',
            content: 'Legacy task',
            done: false,
            dueDate: '2026-02-06',
            priority: 2, // high
            tags: ['work'],
            created: new Date('2026-01-01').getTime(),
          } as LegacyTask,
        ],
      };

      const result = await migration.migrate(legacyData);

      expect(result.success).toBe(true);
      expect(result.tasksUpdated).toBe(1);
      expect(result.errors.length).toBe(0);
    });

    it('should handle priority conversion', async () => {
      const legacyData = {
        tasks: [
          { id: '1', content: 'Task 1', done: false, priority: 1 }, // highest
          { id: '2', content: 'Task 2', done: false, priority: 2 }, // high
          { id: '3', content: 'Task 3', done: false, priority: 3 }, // medium
          { id: '4', content: 'Task 4', done: false, priority: 4 }, // low
          { id: '5', content: 'Task 5', done: false, priority: 5 }, // lowest
        ] as LegacyTask[],
      };

      const result = await migration.migrate(legacyData);

      expect(result.success).toBe(true);
      expect(result.tasksUpdated).toBe(5);
    });

    it('should convert timestamps to ISO strings', async () => {
      const now = Date.now();
      const legacyData = {
        tasks: [
          {
            id: '1',
            content: 'Task',
            done: true,
            created: now - 86400000, // 1 day ago
            completed: now,
          } as LegacyTask,
        ],
      };

      const result = await migration.migrate(legacyData);

      expect(result.success).toBe(true);
      expect(result.tasksUpdated).toBe(1);
    });

    it('should handle malformed legacy data', async () => {
      const badData = {
        tasks: [
          {
            id: '1',
            content: 'Task',
            done: false,
            priority: 999, // Invalid priority
          } as LegacyTask,
        ],
      };

      const result = await migration.migrate(badData);

      // Should still succeed but may have warnings
      expect(result.success).toBe(true);
      expect(result.tasksUpdated).toBe(1);
    });

    it('should report errors for invalid data', async () => {
      const invalidData = { not: 'valid' };

      const result = await migration.migrate(invalidData);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.tasksUpdated).toBe(0);
    });
  });

  describe('Backup and Rollback', () => {
    it('should create backup before migration', async () => {
      const data = {
        version: MigrationVersion.V1_LEGACY,
        tasks: [
          { id: '1', content: 'Test', done: false } as LegacyTask,
        ],
      };

      await migrator.migrate(data);

      const backups = migrator.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });

    it('should list backups in reverse chronological order', async () => {
      // Create multiple backups
      for (let i = 0; i < 3; i++) {
        const data = { tasks: [{ id: `${i}`, content: 'Test', done: false } as LegacyTask] };
        await migrator.migrate(data, MigrationVersion.V1_LEGACY);
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay
      }

      const backups = migrator.listBackups();
      
      expect(backups.length).toBeGreaterThanOrEqual(3);
      // First backup should be most recent
      expect(backups[0].timestamp >= backups[backups.length - 1].timestamp).toBe(true);
    });

    it('should clean old backups', async () => {
      // Create 10 backups
      for (let i = 0; i < 10; i++) {
        const data = { tasks: [{ id: `${i}`, content: 'Test', done: false } as LegacyTask] };
        await migrator.migrate(data, MigrationVersion.V1_LEGACY);
      }

      const beforeCount = migrator.listBackups().length;
      const deleted = migrator.cleanBackups(3); // Keep only 3

      expect(deleted).toBeGreaterThan(0);
      expect(migrator.listBackups().length).toBeLessThanOrEqual(3);
    });

    it('should allow disabling backups', async () => {
      migrator.setBackupEnabled(false);

      const data = {
        tasks: [{ id: '1', content: 'Test', done: false } as LegacyTask],
      };

      const backupsBefore = migrator.listBackups().length;
      await migrator.migrate(data, MigrationVersion.V1_LEGACY);
      const backupsAfter = migrator.listBackups().length;

      expect(backupsAfter).toBe(backupsBefore);
    });
  });

  describe('Migration Validation', () => {
    it('should validate task count is preserved', () => {
      const original = {
        tasks: [
          { id: '1', content: 'Task 1', done: false },
          { id: '2', content: 'Task 2', done: false },
        ],
      };

      const migrated = {
        tasks: [
          { id: '1', name: 'Task 1', status: 'todo' },
          { id: '2', name: 'Task 2', status: 'todo' },
        ],
      };

      const validation = migrator.validateMigration(original, migrated);
      expect(validation.valid).toBe(true);
      expect(validation.issues.length).toBe(0);
    });

    it('should detect task count mismatch', () => {
      const original = {
        tasks: [
          { id: '1', content: 'Task 1', done: false },
          { id: '2', content: 'Task 2', done: false },
        ],
      };

      const migrated = {
        tasks: [
          { id: '1', name: 'Task 1', status: 'todo' },
        ],
      };

      const validation = migrator.validateMigration(original, migrated);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Task count mismatch');
    });
  });

  describe('No Migration Needed', () => {
    it('should skip migration if already at target version', async () => {
      const modernData = {
        version: MigrationVersion.V2_ENHANCED,
        tasks: [],
      };

      const result = await migrator.migrate(modernData);

      expect(result.success).toBe(true);
      expect(result.tasksUpdated).toBe(0);
      expect(result.warnings).toContain('Data already at target version');
    });
  });
});
