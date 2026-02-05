import { describe, it, expect, beforeEach } from 'vitest';
import { TaskLineParser } from '@backend/core/parsers/TaskLineParser';
import { TaskLineSerializer } from '@backend/core/parsers/TaskLineSerializer';
import { StatusRegistry } from '@backend/core/models/StatusRegistry';
import type { Task } from '@backend/core/models/Task';

describe('Task Date Tracking', () => {
  beforeEach(() => {
    StatusRegistry.getInstance().reset();
  });

  describe('TaskLineParser - doneAt parsing', () => {
    it('should parse doneAt from emoji format', () => {
      const parser = new TaskLineParser('emoji');
      const result = parser.parse('- [x] Task name ✅ 2025-01-18');
      
      expect(result.isValid).toBe(true);
      expect(result.task?.doneAt).toBe(new Date('2025-01-18').toISOString());
      expect(result.task?.lastCompletedAt).toBe(new Date('2025-01-18').toISOString());
    });

    it('should parse doneAt from text format', () => {
      const parser = new TaskLineParser('text');
      const result = parser.parse('- [x] Task name [done:: 2025-01-18]');
      
      expect(result.isValid).toBe(true);
      expect(result.task?.doneAt).toBe(new Date('2025-01-18').toISOString());
      expect(result.task?.lastCompletedAt).toBe(new Date('2025-01-18').toISOString());
    });

    it('should parse multiple dates including doneAt', () => {
      const parser = new TaskLineParser('emoji');
      const result = parser.parse('- [x] Task name 📅 2025-01-20 ✅ 2025-01-18 ➕ 2025-01-01');
      
      expect(result.task?.dueAt).toBe(new Date('2025-01-20').toISOString());
      expect(result.task?.doneAt).toBe(new Date('2025-01-18').toISOString());
      expect(result.task?.createdAt).toBe(new Date('2025-01-01').toISOString());
    });
  });

  describe('TaskLineParser - onCompletion parsing', () => {
    it('should parse onCompletion keep from emoji format', () => {
      const parser = new TaskLineParser('emoji');
      const result = parser.parse('- [ ] Task name 🏁 keep');
      
      expect(result.isValid).toBe(true);
      expect(result.task?.onCompletion).toBe('keep');
    });

    it('should parse onCompletion delete from emoji format', () => {
      const parser = new TaskLineParser('emoji');
      const result = parser.parse('- [ ] Task name 🏁 delete');
      
      expect(result.isValid).toBe(true);
      expect(result.task?.onCompletion).toBe('delete');
    });

    it('should parse onCompletion from text format', () => {
      const parser = new TaskLineParser('text');
      const result = parser.parse('- [ ] Task name [onCompletion:: delete]');
      
      expect(result.isValid).toBe(true);
      expect(result.task?.onCompletion).toBe('delete');
    });

    it('should parse onCompletion with other metadata', () => {
      const parser = new TaskLineParser('emoji');
      const result = parser.parse('- [ ] Task name 📅 2025-01-20 🔁 every day 🏁 delete');
      
      expect(result.task?.dueAt).toBe(new Date('2025-01-20').toISOString());
      expect(result.task?.recurrenceText).toBe('every day');
      expect(result.task?.onCompletion).toBe('delete');
    });
  });

  describe('TaskLineSerializer - doneAt serialization', () => {
    it('should serialize doneAt in emoji format', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        doneAt: new Date('2025-01-18').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, 'x', { format: 'emoji' });
      
      expect(line).toContain('✅ 2025-01-18');
    });

    it('should serialize doneAt in text format', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        doneAt: new Date('2025-01-18').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'done',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, 'x', { format: 'text' });
      
      expect(line).toContain('[done:: 2025-01-18]');
    });

    it('should not serialize doneAt if status is not done', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        doneAt: new Date('2025-01-18').toISOString(),
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        status: 'todo',
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, ' ', { format: 'emoji' });
      
      expect(line).not.toContain('✅');
    });
  });

  describe('TaskLineSerializer - onCompletion serialization', () => {
    it('should serialize onCompletion keep in emoji format', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        onCompletion: 'keep',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, ' ', { format: 'emoji' });
      
      expect(line).toContain('🏁 keep');
    });

    it('should serialize onCompletion delete in emoji format', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        onCompletion: 'delete',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, ' ', { format: 'emoji' });
      
      expect(line).toContain('🏁 delete');
    });

    it('should serialize onCompletion in text format', () => {
      const task: Task = {
        id: 'test-1',
        name: 'Test Task',
        dueAt: new Date('2025-01-20').toISOString(),
        onCompletion: 'delete',
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: new Date('2025-01-01').toISOString(),
        updatedAt: new Date('2025-01-01').toISOString(),
      };

      const line = TaskLineSerializer.serialize(task, ' ', { format: 'text' });
      
      expect(line).toContain('[onCompletion:: delete]');
    });
  });

  describe('Round-trip parsing and serialization', () => {
    it('should preserve doneAt through round-trip (emoji)', () => {
      const parser = new TaskLineParser('emoji');
      const originalLine = '- [x] Water plants 📅 2025-01-20 ✅ 2025-01-18 🔁 every week';
      
      const parsed = parser.parse(originalLine);
      expect(parsed.isValid).toBe(true);
      
      const task: Task = {
        id: 'test-1',
        name: parsed.task!.name!,
        dueAt: parsed.task!.dueAt!,
        doneAt: parsed.task!.doneAt,
        recurrenceText: parsed.task!.recurrenceText,
        frequency: { type: 'weekly', interval: 1, weekdays: [0] },
        enabled: false,
        status: 'done',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const serialized = TaskLineSerializer.serialize(task, 'x', { format: 'emoji' });
      
      expect(serialized).toContain('Water plants');
      expect(serialized).toContain('📅 2025-01-20');
      expect(serialized).toContain('✅ 2025-01-18');
      expect(serialized).toContain('🔁 every week');
    });

    it('should preserve onCompletion through round-trip (emoji)', () => {
      const parser = new TaskLineParser('emoji');
      const originalLine = '- [ ] Review PR 📅 2025-01-20 🏁 delete 🔁 every day';
      
      const parsed = parser.parse(originalLine);
      expect(parsed.isValid).toBe(true);
      expect(parsed.task?.onCompletion).toBe('delete');
      
      const task: Task = {
        id: 'test-1',
        name: parsed.task!.name!,
        dueAt: parsed.task!.dueAt!,
        onCompletion: parsed.task!.onCompletion,
        recurrenceText: parsed.task!.recurrenceText,
        frequency: { type: 'daily', interval: 1 },
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const serialized = TaskLineSerializer.serialize(task, ' ', { format: 'emoji' });
      
      expect(serialized).toContain('Review PR');
      expect(serialized).toContain('📅 2025-01-20');
      expect(serialized).toContain('🏁 delete');
      expect(serialized).toContain('🔁 every day');
    });
  });
});
