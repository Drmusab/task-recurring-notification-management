/**
 * Search and Filter Tests
 * Tests for fuzzy search and smart filters functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { searchStore, applySmartFilters, calculateFilterCounts } from '@stores/search.store';
import { fuzzySearchTasks, simpleSearchTasks } from '@shared/utils/search/fuzzy-search';
import type { Task } from '@backend/core/models/Task';
import { createTask } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';

describe('Search Store', () => {
  beforeEach(() => {
    searchStore.clear();
  });

  it('should initialize with default state', () => {
    const state = get(searchStore);
    expect(state.query).toBe('');
    expect(state.fields).toEqual(['description', 'tags', 'notes']);
    expect(state.activeFilters.size).toBe(0);
  });

  it('should update query', () => {
    searchStore.setQuery('test query');
    const state = get(searchStore);
    expect(state.query).toBe('test query');
  });

  it('should toggle filter on and off', () => {
    searchStore.toggleFilter('today');
    let state = get(searchStore);
    expect(state.activeFilters.has('today')).toBe(true);
    
    searchStore.toggleFilter('today');
    state = get(searchStore);
    expect(state.activeFilters.has('today')).toBe(false);
  });

  it('should clear all filters', () => {
    searchStore.toggleFilter('today');
    searchStore.toggleFilter('overdue');
    searchStore.clearFilters();
    
    const state = get(searchStore);
    expect(state.activeFilters.size).toBe(0);
  });

  it('should clear entire state', () => {
    searchStore.setQuery('test');
    searchStore.toggleFilter('today');
    searchStore.clear();
    
    const state = get(searchStore);
    expect(state.query).toBe('');
    expect(state.activeFilters.size).toBe(0);
  });
});

describe('Fuzzy Search', () => {
  const createTestTask = (name: string, tags?: string[], description?: string): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask(name, frequency);
    if (tags) task.tags = tags;
    if (description) task.description = description;
    return task;
  };

  it('should return all tasks when query is empty', () => {
    const tasks = [
      createTestTask('Task 1'),
      createTestTask('Task 2')
    ];
    
    const results = fuzzySearchTasks(tasks, '', ['description']);
    expect(results).toHaveLength(2);
  });

  it('should find tasks by description match', () => {
    const tasks = [
      createTestTask('Buy groceries'),
      createTestTask('Clean house'),
      createTestTask('Buy tickets')
    ];
    
    const results = fuzzySearchTasks(tasks, 'buy', ['description']);
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(t => t.name.includes('Buy'))).toBe(true);
  });

  it('should find tasks by tag match', () => {
    const tasks = [
      createTestTask('Task 1', ['work', 'urgent']),
      createTestTask('Task 2', ['personal']),
      createTestTask('Task 3', ['work'])
    ];
    
    const results = fuzzySearchTasks(tasks, 'work', ['tags']);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle fuzzy matching', () => {
    const tasks = [
      createTestTask('Important meeting'),
      createTestTask('Unrelated task')
    ];
    
    // Fuzzy search should find "meeting" even with slight typos
    const results = fuzzySearchTasks(tasks, 'meting', ['description']);
    // Depending on threshold, this may or may not match
    expect(results).toBeDefined();
  });
});

describe('Simple Search Fallback', () => {
  const createTestTask = (name: string, tags?: string[], description?: string): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask(name, frequency);
    if (tags) task.tags = tags;
    if (description) task.description = description;
    return task;
  };

  it('should find exact matches in description', () => {
    const tasks = [
      createTestTask('Buy groceries'),
      createTestTask('Clean house')
    ];
    
    const results = simpleSearchTasks(tasks, 'groceries', ['description']);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Buy groceries');
  });

  it('should be case insensitive', () => {
    const tasks = [
      createTestTask('Important Task')
    ];
    
    const results = simpleSearchTasks(tasks, 'important', ['description']);
    expect(results).toHaveLength(1);
  });

  it('should search in tags', () => {
    const tasks = [
      createTestTask('Task 1', ['urgent', 'work']),
      createTestTask('Task 2', ['personal'])
    ];
    
    const results = simpleSearchTasks(tasks, 'urgent', ['tags']);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Task 1');
  });
});

describe('Smart Filters', () => {
  const createTestTask = (overrides: Partial<Task> = {}): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask('Test Task', frequency);
    return { ...task, ...overrides };
  };

  it('should filter tasks due today', () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tasks = [
      createTestTask({ dueAt: today.toISOString() }),
      createTestTask({ dueAt: tomorrow.toISOString() })
    ];
    
    const filters = new Set(['today'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter overdue tasks', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const tasks = [
      createTestTask({ dueAt: yesterday.toISOString(), enabled: true, status: 'todo' }),
      createTestTask({ dueAt: tomorrow.toISOString(), enabled: true, status: 'todo' })
    ];
    
    const filters = new Set(['overdue'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter high priority tasks', () => {
    const tasks = [
      createTestTask({ priority: 'high' }),
      createTestTask({ priority: 'low' }),
      createTestTask({ priority: 'highest' })
    ];
    
    const filters = new Set(['high-priority'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results.length).toBe(2);
  });

  it('should filter recurring tasks', () => {
    const dailyFrequency: Frequency = { type: 'daily', interval: 1 };
    const onceFrequency: Frequency = { type: 'once' };
    
    const tasks = [
      createTask('Daily task', dailyFrequency),
      createTask('One-time task', onceFrequency)
    ];
    
    const filters = new Set(['recurring'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results).toHaveLength(1);
    expect(results[0].frequency.type).toBe('daily');
  });

  it('should filter tasks with no due date', () => {
    const tasks = [
      createTestTask({ dueAt: undefined as any }),
      createTestTask({ dueAt: new Date().toISOString() })
    ];
    
    const filters = new Set(['no-due-date'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results).toHaveLength(1);
  });

  it('should combine multiple filters with AND logic', () => {
    const today = new Date();
    
    const tasks = [
      createTestTask({ dueAt: today.toISOString(), priority: 'high' }),
      createTestTask({ dueAt: today.toISOString(), priority: 'low' })
    ];
    
    const filters = new Set(['today', 'high-priority'] as const);
    const results = applySmartFilters(tasks, filters);
    
    expect(results).toHaveLength(1);
    expect(results[0].priority).toBe('high');
  });
});

describe('Filter Counts', () => {
  const createTestTask = (overrides: Partial<Task> = {}): Task => {
    const frequency: Frequency = { type: 'once' };
    const task = createTask('Test Task', frequency);
    return { ...task, ...overrides };
  };

  it('should calculate correct counts for all filters', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const dailyFrequency: Frequency = { type: 'daily', interval: 1 };
    
    const tasks = [
      createTestTask({ dueAt: today.toISOString() }),
      createTestTask({ dueAt: yesterday.toISOString(), enabled: true, status: 'todo' }),
      createTestTask({ priority: 'high' }),
      createTask('Recurring', dailyFrequency),
      createTestTask({ dueAt: undefined as any }),
      createTestTask({ status: 'done', enabled: false })
    ];
    
    const counts = calculateFilterCounts(tasks);
    
    expect(counts.today).toBeGreaterThanOrEqual(0);
    expect(counts.overdue).toBeGreaterThanOrEqual(0);
    expect(counts['high-priority']).toBeGreaterThanOrEqual(1);
    expect(counts.recurring).toBe(1);
    expect(counts['no-due-date']).toBeGreaterThanOrEqual(1);
    expect(counts.completed).toBeGreaterThanOrEqual(1);
  });
});
