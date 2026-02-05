import { describe, it, expect, beforeEach } from 'vitest';
import { FilenameDateExtractor, type FilenameDateConfig } from "@backend/core/settings/FilenameDate";
import { createTask } from '@backend/core/models/Task';
import type { Task } from '@backend/core/models/Task';

describe('FilenameDateExtractor', () => {
  let extractor: FilenameDateExtractor;
  let config: FilenameDateConfig;

  beforeEach(() => {
    extractor = new FilenameDateExtractor();
    config = {
      enabled: true,
      patterns: ['YYYY-MM-DD'],
      folders: ['daily/'],
      targetField: 'scheduled',
    };
  });

  describe('extractDate', () => {
    it('should extract YYYY-MM-DD format', () => {
      const date = extractor.extractDate('daily/2025-01-18-notes.md', config);
      
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2025);
      expect(date!.getMonth()).toBe(0); // January is 0
      expect(date!.getDate()).toBe(18);
    });

    it('should extract YYYYMMDD format', () => {
      config.patterns = ['YYYYMMDD'];
      const date = extractor.extractDate('daily/20250118.md', config);
      
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2025);
      expect(date!.getMonth()).toBe(0);
      expect(date!.getDate()).toBe(18);
    });

    it('should extract DD-MM-YYYY format', () => {
      config.patterns = ['DD-MM-YYYY'];
      const date = extractor.extractDate('daily/18-01-2025.md', config);
      
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2025);
      expect(date!.getMonth()).toBe(0);
      expect(date!.getDate()).toBe(18);
    });

    it('should return null for non-matching filenames', () => {
      const date = extractor.extractDate('daily/random-note.md', config);
      expect(date).toBeNull();
    });

    it('should return null when disabled', () => {
      config.enabled = false;
      const date = extractor.extractDate('daily/2025-01-18.md', config);
      expect(date).toBeNull();
    });

    it('should try multiple patterns in order', () => {
      config.patterns = ['YYYYMMDD', 'YYYY-MM-DD', 'DD-MM-YYYY'];
      
      // Should match second pattern
      const date = extractor.extractDate('daily/2025-01-18.md', config);
      expect(date).not.toBeNull();
      expect(date!.getFullYear()).toBe(2025);
    });

    it('should handle invalid dates gracefully', () => {
      config.patterns = ['YYYY-MM-DD'];
      
      // Feb 30 doesn't exist
      const date1 = extractor.extractDate('daily/2025-02-30.md', config);
      expect(date1).toBeNull();
      
      // Month 13 doesn't exist
      const date2 = extractor.extractDate('daily/2025-13-01.md', config);
      expect(date2).toBeNull();
      
      // Day 0 doesn't exist
      const date3 = extractor.extractDate('daily/2025-01-00.md', config);
      expect(date3).toBeNull();
    });

    it('should cache extracted dates', () => {
      const filepath = 'daily/2025-01-18.md';
      
      // First call
      const date1 = extractor.extractDate(filepath, config);
      
      // Second call should use cache
      const date2 = extractor.extractDate(filepath, config);
      
      expect(date1).toBe(date2); // Same object reference
    });
  });

  describe('isInScope', () => {
    it('should return true for files in configured folders', () => {
      const result = extractor.isInScope('daily/2025-01-18.md', ['daily/']);
      expect(result).toBe(true);
    });

    it('should return false for files outside configured folders', () => {
      const result = extractor.isInScope('projects/task.md', ['daily/']);
      expect(result).toBe(false);
    });

    it('should return true when folder list is empty (all files)', () => {
      const result = extractor.isInScope('any/path/file.md', []);
      expect(result).toBe(true);
    });

    it('should handle multiple folder patterns', () => {
      const folders = ['daily/', 'journal/', 'notes/'];
      
      expect(extractor.isInScope('daily/file.md', folders)).toBe(true);
      expect(extractor.isInScope('journal/file.md', folders)).toBe(true);
      expect(extractor.isInScope('notes/file.md', folders)).toBe(true);
      expect(extractor.isInScope('tasks/file.md', folders)).toBe(false);
    });

    it('should handle paths with backslashes', () => {
      const result = extractor.isInScope('daily\\2025-01-18.md', ['daily/']);
      expect(result).toBe(true);
    });
  });

  describe('applyFilenameDate', () => {
    let task: Task;

    beforeEach(() => {
      task = createTask('Test task', { type: 'daily', interval: 1 });
      delete task.scheduledAt;
      delete task.dueAt;
      delete task.startAt;
    });

    it('should apply date to scheduled field when task has no scheduled date', () => {
      config.targetField = 'scheduled';
      const filepath = 'daily/2025-01-18.md';
      
      const updated = extractor.applyFilenameDate(task, filepath, config);
      
      expect(updated.scheduledAt).toBeDefined();
      const date = new Date(updated.scheduledAt!);
      expect(date.getFullYear()).toBe(2025);
      expect(date.getMonth()).toBe(0);
      expect(date.getDate()).toBe(18);
    });

    it('should apply date to due field when configured', () => {
      config.targetField = 'due';
      const filepath = 'daily/2025-01-18.md';
      
      const updated = extractor.applyFilenameDate(task, filepath, config);
      
      expect(updated.dueAt).toBeDefined();
      const date = new Date(updated.dueAt);
      expect(date.getFullYear()).toBe(2025);
    });

    it('should not override existing date in target field', () => {
      const existingDate = new Date('2025-01-01').toISOString();
      task.scheduledAt = existingDate;
      config.targetField = 'scheduled';
      const filepath = 'daily/2025-01-18.md';
      
      const updated = extractor.applyFilenameDate(task, filepath, config);
      
      expect(updated.scheduledAt).toBe(existingDate);
    });

    it('should not apply date when file is not in scope', () => {
      config.folders = ['daily/'];
      const filepath = 'projects/task.md';
      
      const updated = extractor.applyFilenameDate(task, filepath, config);
      
      expect(updated.scheduledAt).toBeUndefined();
    });

    it('should not apply date when disabled', () => {
      config.enabled = false;
      const filepath = 'daily/2025-01-18.md';
      
      const updated = extractor.applyFilenameDate(task, filepath, config);
      
      expect(updated.scheduledAt).toBeUndefined();
    });
  });
});
