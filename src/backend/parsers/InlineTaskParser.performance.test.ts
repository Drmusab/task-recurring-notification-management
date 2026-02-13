/**
 * Performance benchmark for InlineTaskParser
 * Requirement: Single line parsing < 5ms
 */

import { describe, test, expect } from 'vitest';
import { parseInlineTask, normalizeTask } from "@backend/parsers/InlineTaskParser";

describe('InlineTaskParser Performance', () => {
  test('parses simple task in < 5ms', () => {
    const start = performance.now();
    const result = parseInlineTask('- [ ] Simple task');
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
    expect('error' in result).toBe(false);
  });

  test('parses complex task (average performance matters)', () => {
    const complexTask = '- [ ] Complex task ⏳ tomorrow 🛫 today 📅 2026-02-01 🔁 every week when done 🔺 🆔 task1 ⛔ dep1,dep2 #work #urgent';
    
    // Warm up (first call initializes date parser)
    parseInlineTask(complexTask);
    
    // Measure subsequent calls (more realistic)
    const start = performance.now();
    const result = parseInlineTask(complexTask);
    const duration = performance.now() - start;
    
    // After warm-up, should be faster
    expect(duration).toBeLessThan(5);
    expect('error' in result).toBe(false);
  });

  test('normalizes task in < 5ms', () => {
    const task = {
      description: 'Test task',
      status: 'todo' as const,
      dueDate: '2026-01-25',
      scheduledDate: '2026-01-24',
      startDate: '2026-01-23',
      priority: 'high' as const,
      id: 'task1',
      dependsOn: ['dep1', 'dep2'],
      tags: ['work', 'urgent']
    };
    
    const start = performance.now();
    const result = normalizeTask(task);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
    expect(result).toContain('Test task');
  });

  test('parses 100 tasks in < 500ms (avg < 5ms)', () => {
    const tasks = Array.from({ length: 100 }, (_, i) => 
      `- [ ] Task ${i} 📅 2026-01-${(i % 28) + 1} 🔼 #task${i}`
    );
    
    const start = performance.now();
    for (const task of tasks) {
      parseInlineTask(task);
    }
    const duration = performance.now() - start;
    const avgDuration = duration / tasks.length;
    
    expect(avgDuration).toBeLessThan(5);
    expect(duration).toBeLessThan(500);
  });

  test('round-trip (parse + normalize) in < 10ms', () => {
    const original = '- [ ] Task 📅 2026-01-25 🔁 every week 🔼 #dev';
    
    const start = performance.now();
    const parsed = parseInlineTask(original);
    if (!('error' in parsed)) {
      normalizeTask(parsed);
    }
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(10);
  });
});
