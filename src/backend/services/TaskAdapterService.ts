/**
 * Task Model Adapter
 * 
 * Bridges the gap between:
 * - Obsidian Tasks model (class-based, Moment dates) — used by legacy UI
 * - SiYuan Core model (src/core/models/Task.ts) - interface, ISO strings
 * 
 * WHY: EditTask.svelte uses Obsidian model but new AI/block features need SiYuan model.
 * This adapter allows gradual migration without breaking existing UI.
 */

import type { Task as SiYuanTask, TaskPriority } from '@backend/core/models/Task';
import type { Frequency } from '@backend/core/models/Frequency';
import { Priority as ObsidianPriority } from '@backend/utils/task/priority';
import moment from 'moment';

/**
 * Shape of an Obsidian-style task (legacy bridge).
 * The actual class does not exist in this codebase; this interface
 * describes the duck-typed shape that legacy code passes in.
 */
interface ObsidianTaskLike {
  id: string;
  description: string;
  dueDate?: { toISOString(): string } | null;
  scheduledDate?: { toISOString(): string } | null;
  startDate?: { toISOString(): string } | null;
  createdDate?: { toISOString(): string } | null;
  doneDate?: { toISOString(): string } | null;
  cancelledDate?: { toISOString(): string } | null;
  recurrence?: { toText(): string } | null;
  priority: ObsidianPriority;
  status: { symbol: string; name: string; type: string };
  dependsOn?: string[];
  blockLink?: string;
  tags?: string[];
  taskLocation?: { path: string };
  scheduledDateIsInferred?: boolean;
}

/** Local Status representation (Obsidian compat) */
interface StatusLike {
  symbol: string;
  name: string;
  type: string;
}

/** Local StatusRegistry duck-type */
interface StatusRegistryLike {
  bySymbol?: (s: string) => StatusLike;
}

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
  static obsidianToSiyuan(obsTask: ObsidianTaskLike): SiYuanTask {
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
        : undefined,
      
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
      version: 1,
    };
  }

  /**
   * Convert SiYuan Task to Obsidian Task
   * Note: This creates a minimal ObsidianTask compatible object.
   * Full Obsidian Task requires additional context (TaskLocation, Status registry)
   */
  static siyuanToObsidian(siyTask: SiYuanTask, statusRegistry?: StatusRegistryLike): Partial<ObsidianTaskLike> {
    const status = this.getStatusFromSymbol(siyTask.status || 'todo', statusRegistry);
    
    return {
      id: siyTask.id,
      description: siyTask.name,
      
      // Convert ISO strings to Moment objects
      dueDate: siyTask.dueAt ? moment(siyTask.dueAt) : undefined,
      scheduledDate: siyTask.scheduledAt ? moment(siyTask.scheduledAt) : undefined,
      startDate: siyTask.startAt ? moment(siyTask.startAt) : undefined,
      createdDate: siyTask.createdAt ? moment(siyTask.createdAt) : undefined,
      doneDate: siyTask.doneAt ? moment(siyTask.doneAt) : undefined,
      cancelledDate: siyTask.cancelledAt ? moment(siyTask.cancelledAt) : undefined,
      
      priority: this.siyuanPriorityToObsidian(siyTask.priority),
      
      status,
      
      dependsOn: [...(siyTask.dependsOn || [])],
      tags: [...(siyTask.tags || [])],
      
      blockLink: siyTask.linkedBlockId ? ` ^${siyTask.linkedBlockId}` : '',
      
      // Obsidian-specific defaults
      scheduledDateIsInferred: false,
    };
  }

  /**
   * Convert to UnifiedTask (used by new components)
   */
  static toUnified(source: ObsidianTaskLike | SiYuanTask): UnifiedTask {
    // Check if it's an Obsidian task (has description property and is a class instance)
    if ('description' in source && typeof source.description === 'string') {
      const obs = source as ObsidianTaskLike;
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
        dependsOn: siy.dependsOn ? [...siy.dependsOn] : undefined,
        linkedBlockId: siy.linkedBlockId,
        blockActions: siy.blockActions,
        completionCount: siy.completionCount,
        missCount: siy.missCount,
        currentStreak: siy.currentStreak,
        bestStreak: siy.bestStreak,
        recentCompletions: siy.recentCompletions ? [...siy.recentCompletions] : undefined,
        completionTimes: siy.completionTimes ? [...siy.completionTimes] : undefined,
        completionContexts: siy.completionContexts,
        suggestionHistory: siy.suggestionHistory,
        tags: siy.tags ? [...siy.tags] : undefined,
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
      case ObsidianPriority.Highest: return 'highest';
      case ObsidianPriority.High: return 'high';
      case ObsidianPriority.Medium: return 'medium';
      case ObsidianPriority.None: return 'medium'; // Map 'none' to 'medium'
      case ObsidianPriority.Low: return 'low';
      case ObsidianPriority.Lowest: return 'lowest';
      default: return 'medium';
    }
  }

  /**
   * Convert SiYuan TaskPriority to Obsidian Priority
   */
  private static siyuanPriorityToObsidian(siyPriority?: TaskPriority): ObsidianPriority {
    switch (siyPriority) {
      case 'highest': return ObsidianPriority.Highest;
      case 'high': return ObsidianPriority.High;
      case 'medium': return ObsidianPriority.Medium;
      case 'low': return ObsidianPriority.Low;
      case 'lowest': return ObsidianPriority.Lowest;
      default: return ObsidianPriority.Medium;
    }
  }

  /**
   * Convert Obsidian Recurrence to SiYuan Frequency
   */
  private static recurrenceToFrequency(recurrence: { toText(): string }): Frequency {
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
      return { type: 'yearly', interval: 1, monthOfYear: new Date().getMonth() + 1, dayOfMonth: new Date().getDate() };
    } else {
      return { type: 'custom', interval: 1, rrule: recurrenceText };
    }
  }

  /**
   * Get Obsidian Status from symbol
   */
  private static getStatusFromSymbol(symbol: string, statusRegistry?: StatusRegistryLike): StatusLike {
    if (statusRegistry?.bySymbol) {
      return statusRegistry.bySymbol(symbol === 'done' ? 'x' : symbol === 'cancelled' ? '-' : ' ');
    }
    // Fallback to a minimal Status object
    return {
      symbol: symbol === 'done' ? 'x' : symbol === 'cancelled' ? '-' : ' ',
      name: symbol === 'done' ? 'Done' : symbol === 'cancelled' ? 'Cancelled' : 'Todo',
      type: symbol === 'done' ? 'DONE' : symbol === 'cancelled' ? 'CANCELLED' : 'TODO',
    };
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
  static obsidianToUnified(obsTask: ObsidianTaskLike): UnifiedTask {
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
      dependsOn: siyTask.dependsOn ? [...siyTask.dependsOn] : undefined,
      linkedBlockId: siyTask.linkedBlockId,
      blockActions: siyTask.blockActions,
      completionCount: siyTask.completionCount,
      missCount: siyTask.missCount,
      currentStreak: siyTask.currentStreak,
      bestStreak: siyTask.bestStreak,
      recentCompletions: siyTask.recentCompletions ? [...siyTask.recentCompletions] : undefined,
      completionTimes: siyTask.completionTimes ? [...siyTask.completionTimes] : undefined,
      completionContexts: siyTask.completionContexts,
      suggestionHistory: siyTask.suggestionHistory,
      tags: siyTask.tags ? [...siyTask.tags] : undefined,
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
  static unifiedToObsidian(unified: UnifiedTask): ObsidianTaskLike {
    // We need to import Task class to create proper instance
    // For now, return a compatible object that EditTask can use
    return {
      id: unified.id,
      description: unified.name,
      dueDate: unified.dueAt ? moment(unified.dueAt) : undefined,
      scheduledDate: unified.scheduledAt ? moment(unified.scheduledAt) : undefined,
      startDate: unified.startAt ? moment(unified.startAt) : undefined,
      createdDate: unified.createdAt ? moment(unified.createdAt) : undefined,
      doneDate: unified.doneAt ? moment(unified.doneAt) : undefined,
      cancelledDate: unified.cancelledAt ? moment(unified.cancelledAt) : undefined,
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
      frequency: unified.frequency,
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
