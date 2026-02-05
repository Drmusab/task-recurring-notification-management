/**
 * Task Model Adapter
 * 
 * Bridges the gap between:
 * - Obsidian Tasks model (src/Task/Task.ts) - class-based, Moment dates
 * - SiYuan Core model (src/core/models/Task.ts) - interface, ISO strings
 * 
 * WHY: EditTask.svelte uses Obsidian model but new AI/block features need SiYuan model.
 * This adapter allows gradual migration without breaking existing UI.
 */

import type { Task as ObsidianTask } from '@shared/utils/task/Task';
import type { Task as SiYuanTask, TaskPriority } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';
import type { Priority as ObsidianPriority } from '@shared/utils/task/Priority';
import type { Status } from '@shared/types/Status';
import type { Recurrence } from '@shared/utils/task/Recurrence';
import moment, { type Moment } from 'moment';

/**
 * Unified task representation that can convert between both models.
 * Used as the bridge interface for components that need both formats.
 */
export interface UnifiedTask {
  // Core fields (compatible with both)
  id: string;
  name: string; // Maps to description in Obsidian
  
  // Dates (stored as ISO, converted to Moment for Obsidian)
  dueAt?: string;
  scheduledAt?: string;
  startAt?: string;
  createdAt?: string;
  doneAt?: string;
  cancelledAt?: string;
  
  // Recurrence
  frequency?: Frequency;
  recurrenceText?: string; // Human-readable for UI
  
  // Status & Priority
  enabled: boolean;
  status?: 'todo' | 'done' | 'cancelled';
  priority?: TaskPriority;
  
  // Relationships
  dependsOn?: string[];
  linkedBlockId?: string;
  
  // SiYuan-specific (AI, analytics, block actions)
  blockActions?: SiYuanTask['blockActions'];
  completionCount?: number;
  missCount?: number;
  currentStreak?: number;
  bestStreak?: number;
  recentCompletions?: string[];
  completionTimes?: number[];
  completionContexts?: SiYuanTask['completionContexts'];
  suggestionHistory?: SiYuanTask['suggestionHistory'];
  
  // Obsidian-specific (preserved for compatibility)
  tags?: string[];
  category?: string;
  description?: string; // Additional notes beyond name
  
  // Metadata
  path?: string;
  heading?: string;
  version?: number;
}

export class TaskModelAdapter {
  /**
   * Convert Obsidian Task to SiYuan Task
   */
  static obsidianToSiyuan(obsTask: ObsidianTask): SiYuanTask {
    return {
      id: obsTask.id,
      name: obsTask.description, // Obsidian uses 'description' for task name
      dueAt: obsTask.dueDate?.toISOString() || '',
      scheduledAt: obsTask.scheduledDate?.toISOString(),
      startAt: obsTask.startDate?.toISOString(),
      createdAt: obsTask.createdDate?.toISOString() || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      doneAt: obsTask.doneDate?.toISOString(),
      cancelledAt: obsTask.cancelledDate?.toISOString(),
      
      // Convert Obsidian Recurrence to SiYuan Frequency
      frequency: obsTask.recurrence 
        ? this.recurrenceToFrequency(obsTask.recurrence)
        : { type: 'once' },
      
      enabled: !obsTask.status.symbol.includes('x') && !obsTask.status.symbol.includes('-'),
      
      status: obsTask.status.symbol.includes('x') ? 'done' 
            : obsTask.status.symbol.includes('-') ? 'cancelled'
            : 'todo',
      
      priority: this.obsidianPriorityToSiyuan(obsTask.priority),
      
      dependsOn: obsTask.dependsOn || [],
      linkedBlockId: obsTask.blockLink?.replace(/^\s*\^/, ''),
      
      tags: obsTask.tags || [],
      
      // Initialize analytics fields (will be populated by TaskStorage)
      completionCount: 0,
      missCount: 0,
      currentStreak: 0,
      bestStreak: 0,
      
      path: obsTask.taskLocation?.path,
    };
  }

  /**
   * Convert SiYuan Task to Obsidian Task
   * Note: This creates a minimal ObsidianTask compatible object.
   * Full Obsidian Task requires additional context (TaskLocation, Status registry)
   */
  static siyuanToObsidian(siyTask: SiYuanTask, statusRegistry: any): Partial<ObsidianTask> {
    const status = this.getStatusFromSymbol(siyTask.status || 'todo', statusRegistry);
    
    return {
      id: siyTask.id,
      description: siyTask.name,
      
      // Convert ISO strings to Moment objects
      dueDate: siyTask.dueAt ? moment(siyTask.dueAt) : null,
      scheduledDate: siyTask.scheduledAt ? moment(siyTask.scheduledAt) : null,
      startDate: siyTask.startAt ? moment(siyTask.startAt) : null,
      createdDate: siyTask.createdAt ? moment(siyTask.createdAt) : null,
      doneDate: siyTask.doneAt ? moment(siyTask.doneAt) : null,
      cancelledDate: siyTask.cancelledAt ? moment(siyTask.cancelledAt) : null,
      
      priority: this.siyuanPriorityToObsidian(siyTask.priority),
      
      status,
      
      dependsOn: siyTask.dependsOn || [],
      tags: siyTask.tags || [],
      
      blockLink: siyTask.linkedBlockId ? ` ^${siyTask.linkedBlockId}` : '',
      
      // Obsidian-specific defaults
      scheduledDateIsInferred: false,
    } as Partial<ObsidianTask>;
  }

  /**
   * Convert to UnifiedTask (used by new components)
   */
  static toUnified(source: ObsidianTask | SiYuanTask): UnifiedTask {
    // Check if it's an Obsidian task (has description property and is a class instance)
    if ('description' in source && typeof (source as any).description === 'string') {
      const obs = source as ObsidianTask;
      return {
        id: obs.id,
        name: obs.description,
        dueAt: obs.dueDate?.toISOString(),
        scheduledAt: obs.scheduledDate?.toISOString(),
        startAt: obs.startDate?.toISOString(),
        createdAt: obs.createdDate?.toISOString(),
        doneAt: obs.doneDate?.toISOString(),
        cancelledAt: obs.cancelledDate?.toISOString(),
        enabled: !obs.status.symbol.includes('x') && !obs.status.symbol.includes('-'),
        status: obs.status.symbol.includes('x') ? 'done' 
              : obs.status.symbol.includes('-') ? 'cancelled'
              : 'todo',
        priority: this.obsidianPriorityToSiyuan(obs.priority),
        dependsOn: obs.dependsOn || [],
        linkedBlockId: obs.blockLink?.replace(/^\s*\^/, ''),
        tags: obs.tags || [],
        path: obs.taskLocation?.path,
      };
    } else {
      // It's a SiYuan task
      const siy = source as SiYuanTask;
      return {
        id: siy.id,
        name: siy.name,
        dueAt: siy.dueAt,
        scheduledAt: siy.scheduledAt,
        startAt: siy.startAt,
        createdAt: siy.createdAt,
        doneAt: siy.doneAt,
        cancelledAt: siy.cancelledAt,
        frequency: siy.frequency,
        enabled: siy.enabled,
        status: siy.status,
        priority: siy.priority,
        dependsOn: siy.dependsOn,
        linkedBlockId: siy.linkedBlockId,
        blockActions: siy.blockActions,
        completionCount: siy.completionCount,
        missCount: siy.missCount,
        currentStreak: siy.currentStreak,
        bestStreak: siy.bestStreak,
        recentCompletions: siy.recentCompletions,
        completionTimes: siy.completionTimes,
        completionContexts: siy.completionContexts,
        suggestionHistory: siy.suggestionHistory,
        tags: siy.tags,
        category: siy.category,
        description: siy.description,
        path: siy.path,
        version: siy.version,
      };
    }
  }

  /**
   * Convert Obsidian Priority to SiYuan TaskPriority
   */
  private static obsidianPriorityToSiyuan(obsPriority: ObsidianPriority): TaskPriority {
    switch (obsPriority) {
      case 'highest': return 'highest';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'normal': return 'medium'; // Map 'normal' to 'medium'
      case 'low': return 'low';
      case 'lowest': return 'lowest';
      default: return 'medium';
    }
  }

  /**
   * Convert SiYuan TaskPriority to Obsidian Priority
   */
  private static siyuanPriorityToObsidian(siyPriority?: TaskPriority): ObsidianPriority {
    switch (siyPriority) {
      case 'highest': return 'highest';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      case 'lowest': return 'lowest';
      default: return 'medium';
    }
  }

  /**
   * Convert Obsidian Recurrence to SiYuan Frequency
   */
  private static recurrenceToFrequency(recurrence: Recurrence): Frequency {
    // This is a simplified conversion. Real implementation would parse recurrence rules.
    // For now, return a basic frequency structure.
    const recurrenceText = recurrence.toText();
    
    if (recurrenceText.includes('day')) {
      return { type: 'daily', interval: 1 };
    } else if (recurrenceText.includes('week')) {
      return { type: 'weekly', interval: 1, daysOfWeek: [new Date().getDay()] };
    } else if (recurrenceText.includes('month')) {
      return { type: 'monthly', interval: 1, dayOfMonth: new Date().getDate() };
    } else if (recurrenceText.includes('year')) {
      return { type: 'yearly', interval: 1, month: new Date().getMonth(), dayOfMonth: new Date().getDate() };
    } else {
      return { type: 'custom', rrule: recurrenceText };
    }
  }

  /**
   * Get Obsidian Status from symbol
   */
  private static getStatusFromSymbol(symbol: string, statusRegistry: any): Status {
    if (statusRegistry?.bySymbol) {
      return statusRegistry.bySymbol(symbol === 'done' ? 'x' : symbol === 'cancelled' ? '-' : ' ');
    }
    // Fallback to a minimal Status object
    return {
      symbol: symbol === 'done' ? 'x' : symbol === 'cancelled' ? '-' : ' ',
      name: symbol === 'done' ? 'Done' : symbol === 'cancelled' ? 'Cancelled' : 'Todo',
      type: symbol === 'done' ? 'DONE' : symbol === 'cancelled' ? 'CANCELLED' : 'TODO',
    } as any;
  }

  /**
   * Validate task dates are in correct order
   */
  static validateDateOrder(task: UnifiedTask): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    const start = task.startAt ? new Date(task.startAt).getTime() : null;
    const scheduled = task.scheduledAt ? new Date(task.scheduledAt).getTime() : null;
    const due = task.dueAt ? new Date(task.dueAt).getTime() : null;
    
    if (start && scheduled && start > scheduled) {
      errors.push('Start date cannot be after scheduled date');
    }
    
    if (start && due && start > due) {
      errors.push('Start date cannot be after due date');
    }
    
    if (scheduled && due && scheduled > due) {
      errors.push('Scheduled date cannot be after due date');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if task has AI-enabled data
   */
  static hasAIData(task: UnifiedTask): boolean {
    return !!(
      task.completionTimes?.length ||
      task.completionContexts?.length ||
      task.suggestionHistory?.length
    );
  }

  /**
   * Check if task has block actions
   */
  static hasBlockActions(task: UnifiedTask): boolean {
    return !!(task.blockActions?.length);
  }

  /**
   * Convert Obsidian Task to UnifiedTask
   */
  static obsidianToUnified(obsTask: ObsidianTask): UnifiedTask {
    return {
      id: obsTask.id,
      name: obsTask.description,
      dueAt: obsTask.dueDate?.toISOString(),
      scheduledAt: obsTask.scheduledDate?.toISOString(),
      startAt: obsTask.startDate?.toISOString(),
      createdAt: obsTask.createdDate?.toISOString(),
      doneAt: obsTask.doneDate?.toISOString(),
      cancelledAt: obsTask.cancelledDate?.toISOString(),
      enabled: !obsTask.status.symbol.includes('x') && !obsTask.status.symbol.includes('-'),
      status: obsTask.status.symbol.includes('x') ? 'done' 
            : obsTask.status.symbol.includes('-') ? 'cancelled'
            : 'todo',
      priority: this.obsidianPriorityToSiyuan(obsTask.priority),
      dependsOn: obsTask.dependsOn || [],
      linkedBlockId: obsTask.blockLink?.replace(/^\s*\^/, ''),
      tags: obsTask.tags || [],
      path: obsTask.taskLocation?.path,
      // Initialize empty analytics for new tasks
      completionCount: 0,
      missCount: 0,
    };
  }

  /**
   * Convert SiYuan Task to UnifiedTask
   */
  static siyuanToUnified(siyTask: SiYuanTask): UnifiedTask {
    return {
      id: siyTask.id,
      name: siyTask.name,
      dueAt: siyTask.dueAt,
      scheduledAt: siyTask.scheduledAt,
      startAt: siyTask.startAt,
      createdAt: siyTask.createdAt,
      doneAt: siyTask.doneAt,
      cancelledAt: siyTask.cancelledAt,
      frequency: siyTask.frequency,
      enabled: siyTask.enabled,
      status: siyTask.status,
      priority: siyTask.priority,
      dependsOn: siyTask.dependsOn,
      linkedBlockId: siyTask.linkedBlockId,
      blockActions: siyTask.blockActions,
      completionCount: siyTask.completionCount,
      missCount: siyTask.missCount,
      currentStreak: siyTask.currentStreak,
      bestStreak: siyTask.bestStreak,
      recentCompletions: siyTask.recentCompletions,
      completionTimes: siyTask.completionTimes,
      completionContexts: siyTask.completionContexts,
      suggestionHistory: siyTask.suggestionHistory,
      tags: siyTask.tags,
      category: siyTask.category,
      description: siyTask.description,
      path: siyTask.path,
      version: siyTask.version,
    };
  }

  /**
   * Convert UnifiedTask to Obsidian Task
   * Note: Returns a partial ObsidianTask that can be used with EditTask.svelte
   */
  static unifiedToObsidian(unified: UnifiedTask): any {
    // We need to import Task class to create proper instance
    // For now, return a compatible object that EditTask can use
    return {
      id: unified.id,
      description: unified.name,
      dueDate: unified.dueAt ? moment(unified.dueAt) : null,
      scheduledDate: unified.scheduledAt ? moment(unified.scheduledAt) : null,
      startDate: unified.startAt ? moment(unified.startAt) : null,
      createdDate: unified.createdAt ? moment(unified.createdAt) : null,
      doneDate: unified.doneAt ? moment(unified.doneAt) : null,
      cancelledDate: unified.cancelledAt ? moment(unified.cancelledAt) : null,
      priority: this.siyuanPriorityToObsidian(unified.priority),
      status: {
        symbol: unified.status === 'done' ? 'x' : unified.status === 'cancelled' ? '-' : ' ',
        name: unified.status === 'done' ? 'Done' : unified.status === 'cancelled' ? 'Cancelled' : 'Todo',
        type: unified.status === 'done' ? 'DONE' : unified.status === 'cancelled' ? 'CANCELLED' : 'TODO',
      },
      dependsOn: unified.dependsOn || [],
      tags: unified.tags || [],
      blockLink: unified.linkedBlockId ? ` ^${unified.linkedBlockId}` : '',
      scheduledDateIsInferred: false,
      taskLocation: unified.path ? { path: unified.path } : undefined,
    };
  }

  /**
   * Convert UnifiedTask to SiYuan Task
   */
  static unifiedToSiyuan(unified: UnifiedTask): SiYuanTask {
    return {
      id: unified.id,
      name: unified.name,
      dueAt: unified.dueAt || '',
      scheduledAt: unified.scheduledAt,
      startAt: unified.startAt,
      createdAt: unified.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      doneAt: unified.doneAt,
      cancelledAt: unified.cancelledAt,
      frequency: unified.frequency || { type: 'once' },
      enabled: unified.enabled !== undefined ? unified.enabled : true,
      status: unified.status || 'todo',
      priority: unified.priority,
      dependsOn: unified.dependsOn || [],
      linkedBlockId: unified.linkedBlockId,
      blockActions: unified.blockActions,
      completionCount: unified.completionCount || 0,
      missCount: unified.missCount || 0,
      currentStreak: unified.currentStreak || 0,
      bestStreak: unified.bestStreak || 0,
      recentCompletions: unified.recentCompletions,
      completionTimes: unified.completionTimes,
      completionContexts: unified.completionContexts,
      suggestionHistory: unified.suggestionHistory,
      tags: unified.tags,
      category: unified.category,
      description: unified.description,
      path: unified.path,
      version: unified.version || 1,
    };
  }
}
