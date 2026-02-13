/**
 * Unit Tests for Task Line Serializer
 * Testing lossless round-trip serialization
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TaskLineParser } from '../src/infrastructure/parsers/TaskLineParser';
import { TaskLineSerializer, verifyRoundTrip } from '../src/infrastructure/parsers/TaskLineSerializer';
import { getDefaultSettings } from '../src/domain/models/Settings';
import { StatusRegistry } from '../src/domain/models/TaskStatus';
import { createTask } from '../src/domain/models/Task';

describe('TaskLineSerializer - Emoji Format', () => {
  let serializer: TaskLineSerializer;
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance( );
    const settings = getDefaultSettings();
    settings.preferredFormat = 'emoji';
    serializer = new TaskLineSerializer(settings);
    parser = new TaskLineParser();
  });
  
  it('should serialize simple task', () => {
    const task = createTask({ name: 'Simple task', statusSymbol: ' ', status: 'todo' });
    const line = serializer.serialize(task);
    
    expect(line).toContain('- [ ]');
    expect(line).toContain('Simple task');
  });
  
  it('should serialize completed task', () => {
    const task = createTask({ name: 'Done task', statusSymbol: 'x', status: 'done' });
    const line = serializer.serialize(task);
    
    expect(line).toContain('- [x]');
    expect(line).toContain('Done task');
  });
  
  it('should serialize task with due date', () => {
    const task = createTask({ 
      name: 'Task with due', 
      dueAt: '2026-02-10T00:00:00Z',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('📅');
    expect(line).toContain('2026-02-10');
  });
  
  it('should serialize task with priority', () => {
    const task = createTask({ 
      name: 'High priority', 
      priority: 'high',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('🔼');
  });
  
  it('should serialize task with recurrence', () => {
    const task = createTask({ 
      name: 'Recurring task', 
      recurrenceText: 'every week',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('🔁');
    expect(line).toContain('every week');
  });
  
  it('should serialize task with task ID', () => {
    const task = createTask({ 
      name: 'Task with ID', 
      taskId: 'abc123',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('🆔');
    expect(line).toContain('abc123');
  });
  
  it('should serialize task with dependencies', () => {
    const task = createTask({ 
      name: 'Dependent task', 
      dependsOn: ['task-001', 'task-002'],
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('⛔');
    expect(line).toContain('task-001');
    expect(line).toContain('task-002');
  });
  
  it('should serialize task with tags', () => {
    const task = createTask({ 
      name: 'Task', 
      tags: ['work', 'urgent'],
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('#work');
    expect(line).toContain('#urgent');
  });
  
  it('should serialize complex task', () => {
    const task = createTask({ 
      name: 'Complex task',
      dueAt: '2026-02-10T00:00:00Z',
      scheduledAt: '2026-02-08T00:00:00Z',
      recurrenceText: 'every week',
      priority: 'highest',
      taskId: 'task-001',
      tags: ['work'],
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('Complex task');
    expect(line).toContain('📅');
    expect(line).toContain('⏳');
    expect(line).toContain('🔁');
    expect(line).toContain('⏫');
    expect(line).toContain('🆔');
    expect(line).toContain('#work');
  });
});

describe('TaskLineSerializer - Text Format', () => {
  let serializer: TaskLineSerializer;
  
  beforeEach(() => {
    StatusRegistry.resetInstance();
    const settings = getDefaultSettings();
    settings.preferredFormat = 'text';
    serializer = new TaskLineSerializer(settings);
  });
  
  it('should serialize with text signifiers', () => {
    const task = createTask({ 
      name: 'Task',
      dueAt: '2026-02-10T00:00:00Z',
      priority: 'high',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('due::');
    expect(line).toContain('priority::');
    expect(line).not.toContain('📅');
    expect(line).not.toContain('🔼');
  });
});

describe('Lossless Round-Trip', () => {
  let serializer: TaskLineSerializer;
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance();
    const settings = getDefaultSettings();
    settings.preferredFormat = 'emoji';
    serializer = new TaskLineSerializer(settings);
    parser = new TaskLineParser();
  });
  
  it('should preserve simple task in round-trip', () => {
    const original = '- [ ] Simple task';
    
    const isLossless = verifyRoundTrip(original, parser, serializer);
    expect(isLossless).toBe(true);
  });
  
  it('should preserve complex task in round-trip', () => {
    const original = '- [ ] Task 📅 2026-02-10 🔁 every week ⏫ #work';
    
    const isLossless = verifyRoundTrip(original, parser, serializer);
    expect(isLossless).toBe(true);
  });
  
  it('should preserve unknown fields in round-trip', () => {
    const original = '- [ ] Task 📅 2026-02-10 unknown:: value';
    
    const task = parser.parse(original);
    const serialized = serializer.serialize(task);
    
    expect(serialized).toContain('unknown:: value');
  });
  
  it('should handle parse -> serialize -> parse cycle', () => {
    const original = '- [ ] Meeting 📅 2026-02-15 ⏫ #important';
    
    const task1 = parser.parse(original);
    const serialized = serializer.serialize(task1);
    const task2 = parser.parse(serialized);
    
    expect(task1.name).toBe(task2.name);
    expect(task1.dueAt).toBe(task2.dueAt);
    expect(task1.priority).toBe(task2.priority);
    expect(task1.tags).toEqual(task2.tags);
  });
});

describe('Date Formatting', () => {
  let parser: TaskLineParser;
  
  beforeEach(() => {
    StatusRegistry.resetInstance();
    parser = new TaskLineParser();
  });
  
  it('should format date as YYYY-MM-DD by default', () => {
    const settings = getDefaultSettings();
    settings.dateFormat = 'YYYY-MM-DD';
    const serializer = new TaskLineSerializer(settings);
    
    const task = createTask({ 
      name: 'Task',
      dueAt: '2026-02-10T14:30:00Z',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toContain('2026-02-10');
    expect(line).not.toContain('14:30'); // Time stripped
  });
  
  it('should format date as MM/DD/YYYY', () => {
    const settings = getDefaultSettings();
    settings.dateFormat = 'MM/DD/YYYY';
    const serializer = new TaskLineSerializer(settings);
    
    const task = createTask({ 
      name: 'Task',
      dueAt: '2026-02-10T00:00:00Z',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
  
  it('should format date as DD/MM/YYYY', () => {
    const settings = getDefaultSettings();
    settings.dateFormat = 'DD/MM/YYYY';
    const serializer = new TaskLineSerializer(settings);
    
    const task = createTask({ 
      name: 'Task',
      dueAt: '2026-02-10T00:00:00Z',
      statusSymbol: ' '
    });
    const line = serializer.serialize(task);
    
    expect(line).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
  });
});
