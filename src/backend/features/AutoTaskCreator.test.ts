/**
 * Tests for AutoTaskCreator
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoTaskCreator } from "@backend/features/AutoTaskCreator";
import type { AutoTaskCreatorDeps } from "@backend/features/AutoTaskCreator";
import type { Task } from '@backend/core/models/Task';
import type { InlineTaskSettings } from '@backend/core/settings/PluginSettings';

describe('AutoTaskCreator', () => {
  let autoCreator: AutoTaskCreator;
  let mockDeps: AutoTaskCreatorDeps;
  let savedTasks: Task[] = [];
  
  beforeEach(() => {
    savedTasks = [];
    
    mockDeps = {
      repository: {
        getTaskByBlockId: vi.fn((blockId: string) => {
          return undefined; // No existing task by default
        }),
      } as any,
      settings: vi.fn((): InlineTaskSettings => ({
        enableInlineCreation: true,
        autoCreateOnEnter: true,
        autoCreateOnBlur: true,
        normalizeOnSave: false,
        strictParsing: false,
        showInlineHints: true,
        highlightManagedTasks: true,
      })),
      saveTask: vi.fn(async (task: Task) => {
        savedTasks.push(task);
      }),
    };
    
    autoCreator = new AutoTaskCreator(mockDeps);
  });
  
  afterEach(() => {
    autoCreator.cleanup();
  });
  
  describe('Duplicate Detection', () => {
    test('should skip creation if task already exists for block', async () => {
      // Mock repository to return existing task
      mockDeps.repository.getTaskByBlockId = vi.fn(() => ({
        id: 'existing-task',
        name: 'Existing Task',
      } as Task));
      
      await autoCreator.handleEnter('block-123', '- [ ] Buy milk 📅 tomorrow');
      
      // Should not save a new task
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
      expect(savedTasks.length).toBe(0);
    });
    
    test('should create task if no existing task for block', async () => {
      await autoCreator.handleEnter('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      // Should save a new task
      expect(mockDeps.saveTask).toHaveBeenCalledTimes(1);
      expect(savedTasks.length).toBe(1);
      expect(savedTasks[0].name).toBe('Buy milk');
      expect(savedTasks[0].linkedBlockId).toBe('block-123');
    });
  });
  
  describe('Settings Respect', () => {
    test('should not create on Enter if autoCreateOnEnter is disabled', async () => {
      mockDeps.settings = vi.fn((): InlineTaskSettings => ({
        enableInlineCreation: true,
        autoCreateOnEnter: false, // Disabled
        autoCreateOnBlur: true,
        normalizeOnSave: false,
        strictParsing: false,
        showInlineHints: true,
        highlightManagedTasks: true,
      }));
      
      await autoCreator.handleEnter('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
    });
    
    test('should not create on Blur if autoCreateOnBlur is disabled', async () => {
      mockDeps.settings = vi.fn((): InlineTaskSettings => ({
        enableInlineCreation: true,
        autoCreateOnEnter: true,
        autoCreateOnBlur: false, // Disabled
        normalizeOnSave: false,
        strictParsing: false,
        showInlineHints: true,
        highlightManagedTasks: true,
      }));
      
      await autoCreator.handleBlur('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
    });
    
    test('should not create if enableInlineCreation is disabled', async () => {
      mockDeps.settings = vi.fn((): InlineTaskSettings => ({
        enableInlineCreation: false, // Disabled
        autoCreateOnEnter: true,
        autoCreateOnBlur: true,
        normalizeOnSave: false,
        strictParsing: false,
        showInlineHints: true,
        highlightManagedTasks: true,
      }));
      
      await autoCreator.handleEnter('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
    });
  });
  
  describe('Task Parsing', () => {
    test('should create task with correct fields from parsed checklist', async () => {
      await autoCreator.handleEnter(
        'block-123',
        '- [ ] Write report 📅 2026-01-25 🔼 #work'
      );
      
      expect(savedTasks.length).toBe(1);
      const task = savedTasks[0];
      
      expect(task.name).toBe('Write report');
      expect(task.linkedBlockId).toBe('block-123');
      expect(task.priority).toBe(2); // medium
      expect(task.tags).toContain('work');
      expect(task.due).toEqual(new Date('2026-01-25'));
    });
    
    test('should skip non-checklist text', async () => {
      await autoCreator.handleEnter('block-123', 'Just some regular text');
      
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
    });
    
    test('should handle parse errors gracefully', async () => {
      // Invalid date should trigger error but not crash
      await autoCreator.handleEnter(
        'block-123',
        '- [ ] Task with invalid date 📅 invaliddate'
      );
      
      // Should not save task due to parse error
      expect(mockDeps.saveTask).not.toHaveBeenCalled();
    });
  });
  
  describe('Debouncing', () => {
    test('handleEnter should not debounce (immediate)', async () => {
      const startTime = Date.now();
      
      await autoCreator.handleEnter('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should complete quickly (< 100ms)
      expect(elapsed).toBeLessThan(100);
      expect(savedTasks.length).toBe(1);
    });
    
    test('handleBlur should debounce (500ms delay)', async () => {
      const startTime = Date.now();
      
      // Trigger blur - should be debounced
      autoCreator.handleBlur('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      // Wait for debounce
      await new Promise(resolve => setTimeout(resolve, 600));
      
      const endTime = Date.now();
      const elapsed = endTime - startTime;
      
      // Should have waited for debounce (~500-600ms)
      expect(elapsed).toBeGreaterThan(500);
      expect(savedTasks.length).toBe(1);
    });
  });
  
  describe('Cleanup', () => {
    test('should cleanup pending operations', async () => {
      // Trigger a debounced operation
      autoCreator.handleBlur('block-123', '- [ ] Buy milk 📅 2026-01-25');
      
      // Cleanup immediately
      autoCreator.cleanup();
      
      // Wait to see if operation completes
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should NOT have saved because cleanup cancelled it
      expect(savedTasks.length).toBe(0);
    });
  });
});
