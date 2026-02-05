/**
 * Comprehensive tests for InlineTaskParser
 * 
 * Test coverage:
 * - Basic parsing (10 tests)
 * - Date parsing (8 tests)
 * - Recurrence parsing (10 tests)
 * - Priority (3 tests)
 * - IDs and Dependencies (6 tests)
 * - Tags (5 tests)
 * - Edge Cases (8+ tests)
 */

import { describe, test, expect } from 'vitest';
import { 
  parseInlineTask, 
  normalizeTask, 
  validateSyntax,
  type ParsedTask,
  type ParseError
} from "@backend/parsers/InlineTaskParser";

describe('InlineTaskParser', () => {
  describe('Basic Parsing (10 tests)', () => {
    test('parses minimal task with description only', () => {
      const result = parseInlineTask('- [ ] Buy milk');
      expect((result as ParseError).error).toBeUndefined();
      const task = result as ParsedTask;
      expect(task.description).toBe('Buy milk');
      expect(task.status).toBe('todo');
      expect(task.dueDate).toBeUndefined();
      expect(task.priority).toBeUndefined();
      expect(task.tags).toBeUndefined();
    });

    test('parses task with single metadata item (due date)', () => {
      const result = parseInlineTask('- [ ] Review document 📅 2026-01-25');
      const task = result as ParsedTask;
      expect(task.description).toBe('Review document');
      expect(task.dueDate).toBe('2026-01-25');
      expect(task.status).toBe('todo');
    });

    test('parses task with multiple metadata items', () => {
      const result = parseInlineTask('- [ ] Complete report 📅 2026-01-25 🔼 #work');
      const task = result as ParsedTask;
      expect(task.description).toBe('Complete report');
      expect(task.dueDate).toBe('2026-01-25');
      expect(task.priority).toBe('medium');
      expect(task.tags).toEqual(['work']);
    });

    test('parses completed task', () => {
      const result = parseInlineTask('- [x] Finished task 📅 2026-01-20');
      const task = result as ParsedTask;
      expect(task.status).toBe('done');
      expect(task.description).toBe('Finished task');
      expect(task.dueDate).toBe('2026-01-20');
    });

    test('parses cancelled task', () => {
      const result = parseInlineTask('- [-] Cancelled meeting 📅 2026-01-22');
      const task = result as ParsedTask;
      expect(task.status).toBe('cancelled');
      expect(task.description).toBe('Cancelled meeting');
      expect(task.dueDate).toBe('2026-01-22');
    });

    test('handles task with extra whitespace', () => {
      const result = parseInlineTask('  -   [ ]   Task with spaces   📅   2026-01-25  ');
      const task = result as ParsedTask;
      expect(task.description).toBe('Task with spaces');
      expect(task.dueDate).toBe('2026-01-25');
    });

    test('preserves description with special characters', () => {
      const result = parseInlineTask('- [ ] Task with (parentheses) & symbols! 📅 2026-01-25');
      const task = result as ParsedTask;
      expect(task.description).toBe('Task with (parentheses) & symbols!');
    });

    test('handles uppercase status markers', () => {
      const result = parseInlineTask('- [X] Task done');
      const task = result as ParsedTask;
      expect(task.status).toBe('done');
    });

    test('returns error for non-checklist input', () => {
      const result = parseInlineTask('Just a regular line of text');
      expect((result as ParseError).error).toBe(true);
      expect((result as ParseError).message).toContain('checklist');
    });

    test('returns error for empty input', () => {
      const result = parseInlineTask('');
      expect((result as ParseError).error).toBe(true);
    });
  });

  describe('Date Parsing (8 tests)', () => {
    test('parses ISO date format', () => {
      const result = parseInlineTask('- [ ] Task 📅 2026-01-25');
      const task = result as ParsedTask;
      expect(task.dueDate).toBe('2026-01-25');
    });

    test('parses natural language "today"', () => {
      const today = new Date();
      const isoToday = today.toISOString().split('T')[0];
      const result = parseInlineTask('- [ ] Task 📅 today');
      const task = result as ParsedTask;
      expect(task.dueDate).toBe(isoToday);
    });

    test('parses natural language "tomorrow"', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isoTomorrow = tomorrow.toISOString().split('T')[0];
      const result = parseInlineTask('- [ ] Task 📅 tomorrow');
      const task = result as ParsedTask;
      expect(task.dueDate).toBe(isoTomorrow);
    });

    test('parses natural language "next week"', () => {
      const result = parseInlineTask('- [ ] Task 📅 next week');
      if ('error' in result) {
        console.log('Parse error:', result);
      }
      const task = result as ParsedTask;
      expect(task.dueDate).toBeDefined();
      // Verify it's roughly 7 days from now
      const dueDate = new Date(task.dueDate!);
      const now = new Date();
      const diffDays = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });

    test('parses multiple date fields', () => {
      const result = parseInlineTask('- [ ] Task ⏳ today 🛫 yesterday 📅 tomorrow');
      const task = result as ParsedTask;
      expect(task.scheduledDate).toBeDefined();
      expect(task.startDate).toBeDefined();
      expect(task.dueDate).toBeDefined();
    });

    test('returns error for invalid date', () => {
      const result = parseInlineTask('- [ ] Task 📅 notadate');
      expect((result as ParseError).error).toBe(true);
      expect((result as ParseError).message).toContain('Invalid due date');
    });

    test('returns error for malformed ISO date', () => {
      const result = parseInlineTask('- [ ] Task 📅 2026-13-45');
      expect((result as ParseError).error).toBe(true);
    });

    test('parses scheduled and start dates correctly', () => {
      const result = parseInlineTask('- [ ] Task ⏳ 2026-01-24 🛫 2026-01-23');
      const task = result as ParsedTask;
      expect(task.scheduledDate).toBe('2026-01-24');
      expect(task.startDate).toBe('2026-01-23');
    });
  });

  describe('Recurrence Parsing (10 tests)', () => {
    test('parses daily recurrence', () => {
      const result = parseInlineTask('- [ ] Daily task 🔁 every day');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('FREQ=DAILY');
      expect(task.recurrence!.mode).toBe('scheduled');
    });

    test('parses weekly recurrence', () => {
      const result = parseInlineTask('- [ ] Weekly task 🔁 every week');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('FREQ=WEEKLY');
      expect(task.recurrence!.mode).toBe('scheduled');
    });

    test('parses monthly recurrence', () => {
      const result = parseInlineTask('- [ ] Monthly task 🔁 every month');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('FREQ=MONTHLY');
    });

    test('parses yearly recurrence', () => {
      const result = parseInlineTask('- [ ] Yearly task 🔁 every year');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('FREQ=YEARLY');
    });

    test('parses recurrence with interval', () => {
      const result = parseInlineTask('- [ ] Task 🔁 every 2 weeks');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('INTERVAL=2');
    });

    test('parses "when done" mode', () => {
      const result = parseInlineTask('- [ ] Task 🔁 every week when done');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.mode).toBe('done');
    });

    test('parses weekday pattern', () => {
      const result = parseInlineTask('- [ ] Task 🔁 every weekday');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toBeDefined();
    });

    test('parses "every 3 days" pattern', () => {
      const result = parseInlineTask('- [ ] Task 🔁 every 3 days');
      const task = result as ParsedTask;
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.rule).toContain('INTERVAL=3');
    });

    test('returns error for invalid recurrence', () => {
      const result = parseInlineTask('- [ ] Task 🔁 invalid pattern');
      expect((result as ParseError).error).toBe(true);
      expect((result as ParseError).message).toContain('recurrence');
    });

    test('combines recurrence with other metadata', () => {
      const result = parseInlineTask('- [ ] Task 📅 2026-01-25 🔁 every week 🔼');
      const task = result as ParsedTask;
      expect(task.dueDate).toBe('2026-01-25');
      expect(task.recurrence).toBeDefined();
      expect(task.priority).toBe('medium');
    });
  });

  describe('Priority (3 tests)', () => {
    test('parses high priority', () => {
      const result = parseInlineTask('- [ ] Urgent task 🔺');
      const task = result as ParsedTask;
      expect(task.priority).toBe('high');
    });

    test('parses medium priority', () => {
      const result = parseInlineTask('- [ ] Important task 🔼');
      const task = result as ParsedTask;
      expect(task.priority).toBe('medium');
    });

    test('parses low priority', () => {
      const result = parseInlineTask('- [ ] Low priority 🔽');
      const task = result as ParsedTask;
      expect(task.priority).toBe('low');
    });
  });

  describe('IDs and Dependencies (6 tests)', () => {
    test('parses task ID', () => {
      const result = parseInlineTask('- [ ] Task 🆔 task-123');
      const task = result as ParsedTask;
      expect(task.id).toBe('task-123');
    });

    test('parses ID with underscores and hyphens', () => {
      const result = parseInlineTask('- [ ] Task 🆔 my_task-456');
      const task = result as ParsedTask;
      expect(task.id).toBe('my_task-456');
    });

    test('parses single dependency', () => {
      const result = parseInlineTask('- [ ] Task ⛔ task1');
      const task = result as ParsedTask;
      expect(task.dependsOn).toEqual(['task1']);
    });

    test('parses multiple dependencies', () => {
      const result = parseInlineTask('- [ ] Task ⛔ task1,task2,task3');
      const task = result as ParsedTask;
      expect(task.dependsOn).toEqual(['task1', 'task2', 'task3']);
    });

    test('parses dependencies with spaces', () => {
      const result = parseInlineTask('- [ ] Task ⛔ task1, task2, task3');
      const task = result as ParsedTask;
      expect(task.dependsOn).toEqual(['task1', 'task2', 'task3']);
    });

    test('combines ID and dependencies', () => {
      const result = parseInlineTask('- [ ] Task 🆔 main-task ⛔ dep1,dep2');
      const task = result as ParsedTask;
      expect(task.id).toBe('main-task');
      expect(task.dependsOn).toEqual(['dep1', 'dep2']);
    });
  });

  describe('Tags (5 tests)', () => {
    test('parses single tag', () => {
      const result = parseInlineTask('- [ ] Task #work');
      const task = result as ParsedTask;
      expect(task.tags).toEqual(['work']);
    });

    test('parses multiple tags', () => {
      const result = parseInlineTask('- [ ] Task #work #urgent #review');
      const task = result as ParsedTask;
      expect(task.tags).toEqual(['work', 'urgent', 'review']);
    });

    test('parses tags with hyphens', () => {
      const result = parseInlineTask('- [ ] Task #code-review');
      const task = result as ParsedTask;
      expect(task.tags).toEqual(['code-review']);
    });

    test('parses tags with underscores', () => {
      const result = parseInlineTask('- [ ] Task #bug_fix');
      const task = result as ParsedTask;
      expect(task.tags).toEqual(['bug_fix']);
    });

    test('parses tags mixed with other metadata', () => {
      const result = parseInlineTask('- [ ] Task 📅 2026-01-25 #work 🔼 #urgent');
      const task = result as ParsedTask;
      expect(task.tags).toEqual(['work', 'urgent']);
      expect(task.dueDate).toBe('2026-01-25');
      expect(task.priority).toBe('medium');
    });
  });

  describe('Edge Cases (8+ tests)', () => {
    test('handles empty description', () => {
      const result = parseInlineTask('- [ ] 📅 2026-01-25');
      const task = result as ParsedTask;
      expect(task.description).toBe('');
      expect(task.dueDate).toBe('2026-01-25');
    });

    test('handles very long description', () => {
      const longDesc = 'A'.repeat(500);
      const result = parseInlineTask(`- [ ] ${longDesc} 📅 2026-01-25`);
      const task = result as ParsedTask;
      expect(task.description).toBe(longDesc);
    });

    test('handles special characters in description', () => {
      const result = parseInlineTask('- [ ] Task with $pecial @chars! & more');
      const task = result as ParsedTask;
      expect(task.description).toBe('Task with $pecial @chars! & more');
    });

    test('handles emoji in description (non-metadata)', () => {
      const result = parseInlineTask('- [ ] Task with 😀 emoji 📅 2026-01-25');
      const task = result as ParsedTask;
      expect(task.description).toContain('😀');
    });

    test('handles multiple priority markers (last wins)', () => {
      const result = parseInlineTask('- [ ] Task 🔺 🔼 🔽');
      const task = result as ParsedTask;
      expect(task.priority).toBe('low');
    });

    test('handles whitespace between tokens', () => {
      const result = parseInlineTask('- [ ] Task    📅   2026-01-25    🔼   #tag');
      const task = result as ParsedTask;
      expect(task.dueDate).toBe('2026-01-25');
      expect(task.priority).toBe('medium');
      expect(task.tags).toEqual(['tag']);
    });

    test('handles all features combined', () => {
      const result = parseInlineTask(
        '- [ ] Complex task ⏳ tomorrow 🛫 today 📅 2026-01-26 🔁 every week when done 🔺 🆔 task1 ⛔ dep1,dep2 #work #urgent'
      );
      const task = result as ParsedTask;
      expect(task.description).toBe('Complex task');
      expect(task.scheduledDate).toBeDefined();
      expect(task.startDate).toBeDefined();
      expect(task.dueDate).toBe('2026-01-26');
      expect(task.recurrence).toBeDefined();
      expect(task.recurrence!.mode).toBe('done');
      expect(task.priority).toBe('high');
      expect(task.id).toBe('task1');
      expect(task.dependsOn).toEqual(['dep1', 'dep2']);
      expect(task.tags).toEqual(['work', 'urgent']);
    });

    test('handles metadata without description', () => {
      const result = parseInlineTask('- [ ] 📅 2026-01-25 🔼 #work');
      const task = result as ParsedTask;
      expect(task.description).toBe('');
      expect(task.dueDate).toBe('2026-01-25');
    });
  });

  describe('normalizeTask', () => {
    test('produces canonical format for minimal task', () => {
      const task: ParsedTask = {
        description: 'Test',
        status: 'todo'
      };
      const normalized = normalizeTask(task);
      expect(normalized).toBe('- [ ] Test');
    });

    test('produces canonical format with due date and priority', () => {
      const task: ParsedTask = {
        description: 'Test',
        status: 'todo',
        dueDate: '2026-01-25',
        priority: 'high',
        tags: ['work']
      };
      const normalized = normalizeTask(task);
      expect(normalized).toBe('- [ ] Test 📅 2026-01-25 🔺 #work');
    });

    test('produces canonical format for done task', () => {
      const task: ParsedTask = {
        description: 'Done task',
        status: 'done',
        dueDate: '2026-01-25'
      };
      const normalized = normalizeTask(task);
      expect(normalized).toBe('- [x] Done task 📅 2026-01-25');
    });

    test('produces canonical format for cancelled task', () => {
      const task: ParsedTask = {
        description: 'Cancelled',
        status: 'cancelled'
      };
      const normalized = normalizeTask(task);
      expect(normalized).toBe('- [-] Cancelled');
    });

    test('round-trip parsing preserves data', () => {
      const original = '- [ ] Task 📅 2026-01-25 🔼 #dev';
      const parsed = parseInlineTask(original) as ParsedTask;
      const normalized = normalizeTask(parsed);
      const reparsed = parseInlineTask(normalized) as ParsedTask;
      
      expect(reparsed.description).toBe(parsed.description);
      expect(reparsed.dueDate).toBe(parsed.dueDate);
      expect(reparsed.priority).toBe(parsed.priority);
      expect(reparsed.tags).toEqual(parsed.tags);
    });

    test('includes all metadata in canonical order', () => {
      const task: ParsedTask = {
        description: 'Full task',
        status: 'todo',
        dueDate: '2026-01-25',
        scheduledDate: '2026-01-24',
        startDate: '2026-01-23',
        priority: 'medium',
        id: 'task1',
        dependsOn: ['dep1', 'dep2'],
        tags: ['work', 'urgent']
      };
      const normalized = normalizeTask(task);
      expect(normalized).toContain('- [ ]');
      expect(normalized).toContain('Full task');
      expect(normalized).toContain('📅 2026-01-25');
      expect(normalized).toContain('⏳ 2026-01-24');
      expect(normalized).toContain('🛫 2026-01-23');
      expect(normalized).toContain('🔼');
      expect(normalized).toContain('🆔 task1');
      expect(normalized).toContain('⛔ dep1,dep2');
      expect(normalized).toContain('#work');
      expect(normalized).toContain('#urgent');
    });
  });

  describe('validateSyntax', () => {
    test('validates correct syntax', () => {
      const result = validateSyntax('- [ ] Valid task 📅 2026-01-25');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects invalid checklist format', () => {
      const result = validateSyntax('Not a task');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Not a checklist item');
    });

    test('detects empty input', () => {
      const result = validateSyntax('');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('detects duplicate due dates', () => {
      const result = validateSyntax('- [ ] Task 📅 2026-01-25 📅 2026-01-26');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('due date'))).toBe(true);
    });

    test('detects duplicate IDs', () => {
      const result = validateSyntax('- [ ] Task 🆔 id1 🆔 id2');
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('ID'))).toBe(true);
    });

    test('validates task with all valid tokens', () => {
      const result = validateSyntax('- [ ] Task 📅 2026-01-25 ⏳ today 🛫 yesterday 🔁 every week 🔼 🆔 id1 ⛔ dep1 #tag');
      expect(result.valid).toBe(true);
    });

    test('allows empty description with metadata', () => {
      const result = validateSyntax('- [ ] 📅 2026-01-25');
      expect(result.valid).toBe(true);
    });
  });
});
