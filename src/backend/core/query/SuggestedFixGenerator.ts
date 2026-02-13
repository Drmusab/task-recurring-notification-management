/**
 * SuggestedFixGenerator - Generate actionable fixes for unmatched tasks
 * 
 * Analyzes why tasks didn't match query filters and provides specific,
 * actionable suggestions for how to modify tasks to make them match.
 * 
 * Phase 4: Explanation Enhancements
 * 
 * @module SuggestedFixGenerator
 */

import type { Task } from "@backend/core/models/Task";
import type { TaskExplanation, FilterExplanation } from "./QueryExplainer";

export interface SuggestedFix {
  /** Unique ID for this fix */
  id: string;
  /** Task this fix applies to */
  taskId: string;
  /** Human-readable description of the fix */
  description: string;
  /** Type of fix */
  type: FixType;
  /** Confidence level (0-1) */
  confidence: number;
  /** Estimated effort (1-5, low to high) */
  effort: number;
  /** The filter that would be satisfied by this fix */
  targetFilter: string;
  /** Patch object with changes to apply */
  patch: TaskPatch;
  /** Impact: how many filters this would satisfy */
  impact: number;
}

export type FixType =
  | "change_priority"
  | "set_due_date"
  | "add_due_date"
  | "remove_due_date"
  | "add_tag"
  | "remove_tag"
  | "change_status"
  | "add_dependency"
  | "remove_dependency"
  | "change_field"
  | "add_field"
  | "remove_field";

export interface TaskPatch {
  [key: string]: any;
}

export interface FixGroup {
  task: Task;
  taskExplanation: TaskExplanation;
  fixes: SuggestedFix[];
  bestFix?: SuggestedFix;
  quickFixAvailable: boolean;
}

/**
 * Generates suggested fixes for tasks that don't match query filters
 */
export class SuggestedFixGenerator {
  private fixIdCounter = 0;

  /**
   * Generate fixes for a single task
   */
  generateFixes(taskExplanation: TaskExplanation): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // Only generate fixes for unmatched tasks
    if (taskExplanation.matched) {
      return fixes;
    }

    // Analyze each failed filter
    for (const filterExplanation of taskExplanation.filterExplanations) {
      if (!filterExplanation.matched) {
        const filterFixes = this.generateFixesForFilter(
          taskExplanation.task,
          filterExplanation
        );
        fixes.push(...filterFixes);
      }
    }

    // Sort by confidence and impact
    fixes.sort((a, b) => {
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      if (b.impact !== a.impact) {
        return b.impact - a.impact;
      }
      return a.effort - b.effort;
    });

    return fixes;
  }

  /**
   * Generate fixes for multiple tasks
   */
  generateBatchFixes(taskExplanations: TaskExplanation[]): FixGroup[] {
    return taskExplanations
      .filter(te => !te.matched)
      .map(te => {
        const fixes = this.generateFixes(te);
        const bestFix = fixes.length > 0 ? fixes[0] : undefined;
        const quickFixAvailable = fixes.some(f => f.effort <= 2 && f.confidence >= 0.8);

        return {
          task: te.task,
          taskExplanation: te,
          fixes,
          bestFix,
          quickFixAvailable
        };
      })
      .filter(group => group.fixes.length > 0);
  }

  /**
   * Get the best fix for each task (highest confidence/impact)
   */
  getBestFixes(taskExplanations: TaskExplanation[]): SuggestedFix[] {
    const groups = this.generateBatchFixes(taskExplanations);
    return groups
      .filter(g => g.bestFix !== undefined)
      .map(g => g.bestFix!);
  }

  /**
   * Generate fixes for a specific filter
   */
  private generateFixesForFilter(
    task: Task,
    filterExplanation: FilterExplanation
  ): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];
    const filterName = filterExplanation.filterName;
    const filterDesc = filterExplanation.filterDescription;

    // Parse filter to determine fix type
    // This is a simplified version - can be enhanced with actual filter AST

    // Priority filters
    if (filterName.includes("priority") || filterDesc.toLowerCase().includes("priority")) {
      fixes.push(...this.generatePriorityFixes(task, filterDesc));
    }

    // Due date filters
    if (filterName.includes("due") || filterDesc.toLowerCase().includes("due")) {
      fixes.push(...this.generateDueDateFixes(task, filterDesc));
    }

    // Tag filters
    if (filterName.includes("tag") || filterDesc.toLowerCase().includes("tag")) {
      fixes.push(...this.generateTagFixes(task, filterDesc));
    }

    // Status filters
    if (filterName.includes("status") || filterDesc.toLowerCase().includes("status")) {
      fixes.push(...this.generateStatusFixes(task, filterDesc));
    }

    // Dependency filters
    if (filterName.includes("depends") || filterDesc.toLowerCase().includes("depend")) {
      fixes.push(...this.generateDependencyFixes(task, filterDesc));
    }

    // Recurrence filters
    if (filterName.includes("recur") || filterDesc.toLowerCase().includes("recur")) {
      fixes.push(...this.generateRecurrenceFixes(task, filterDesc));
    }

    return fixes;
  }

  /**
   * Generate priority-related fixes
   */
  private generatePriorityFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // Extract target priority from filter description
    const priorityMatch = filterDesc.match(/priority\s*(>=|>|<=|<|=|≥|≤)\s*(high|medium|low)/i);
    if (priorityMatch && priorityMatch[2]) {
      const operator = priorityMatch[1];
      const targetPriority = priorityMatch[2]!.toLowerCase();

      let suggestedPriority: string | undefined;
      let confidence = 0.9;

      if (operator === '>=' || operator === '≥' || operator === '>') {
        suggestedPriority = targetPriority;
      } else if (operator === '<=' || operator === '≤' || operator === '<') {
        suggestedPriority = targetPriority;
      } else if (operator === '=') {
        suggestedPriority = targetPriority;
      }

      if (suggestedPriority) {
        fixes.push({
          id: this.generateFixId(),
          taskId: task.id,
          description: `Change priority to ${suggestedPriority.toUpperCase()}`,
          type: "change_priority",
          confidence,
          effort: 1,
          targetFilter: filterDesc,
          patch: {
            priority: suggestedPriority
          },
          impact: 1
        });
      }
    }

    return fixes;
  }

  /**
   * Generate due date-related fixes
   */
  private generateDueDateFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // "due before <date>" pattern
    if (filterDesc.match(/due\s+before/i)) {
      const dateMatch = filterDesc.match(/before\s+(\d{4}-\d{2}-\d{2}|today|tomorrow)/i);
      if (dateMatch && dateMatch[1]) {
        const targetDate = this.parseDate(dateMatch[1]!);
        if (targetDate) {
          fixes.push({
            id: this.generateFixId(),
            taskId: task.id,
            description: `Set due date before ${dateMatch[1]}`,
            type: task.dueAt ? "set_due_date" : "add_due_date",
            confidence: 0.85,
            effort: 2,
            targetFilter: filterDesc,
            patch: {
              dueAt: new Date(targetDate.getTime() - 24 * 60 * 60 * 1000).toISOString()
            },
            impact: 1
          });
        }
      }
    }

    // "due after <date>" pattern
    if (filterDesc.match(/due\s+after/i)) {
      const dateMatch = filterDesc.match(/after\s+(\d{4}-\d{2}-\d{2}|today|tomorrow)/i);
      if (dateMatch && dateMatch[1]) {
        const targetDate = this.parseDate(dateMatch[1]!);
        if (targetDate) {
          fixes.push({
            id: this.generateFixId(),
            taskId: task.id,
            description: `Set due date after ${dateMatch[1]}`,
            type: task.dueAt ? "set_due_date" : "add_due_date",
            confidence: 0.85,
            effort: 2,
            targetFilter: filterDesc,
            patch: {
              dueAt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString()
            },
            impact: 1
          });
        }
      }
    }

    // "has due date" pattern
    if (filterDesc.match(/has\s+due\s*date/i) && !task.dueAt) {
      fixes.push({
        id: this.generateFixId(),
        taskId: task.id,
        description: "Add a due date",
        type: "add_due_date",
        confidence: 0.7,
        effort: 2,
        targetFilter: filterDesc,
        patch: {
          dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 1 week from now
        },
        impact: 1
      });
    }

    // "no due date" pattern
    if (filterDesc.match(/no\s+due\s*date/i) && task.dueAt) {
      fixes.push({
        id: this.generateFixId(),
        taskId: task.id,
        description: "Remove due date",
        type: "remove_due_date",
        confidence: 0.95,
        effort: 1,
        targetFilter: filterDesc,
        patch: {
          dueAt: null
        },
        impact: 1
      });
    }

    return fixes;
  }

  /**
   * Generate tag-related fixes
   */
  private generateTagFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // "has tag #tagname" pattern
    const hasTagMatch = filterDesc.match(/has\s+tag\s+#(\w+)/i);
    if (hasTagMatch && hasTagMatch[1]) {
      const targetTag = hasTagMatch[1]!;
      const currentTags = task.tags || [];
      
      if (!currentTags.includes(targetTag)) {
        fixes.push({
          id: this.generateFixId(),
          taskId: task.id,
          description: `Add tag #${targetTag}`,
          type: "add_tag",
          confidence: 0.9,
          effort: 1,
          targetFilter: filterDesc,
          patch: {
            tags: [...currentTags, targetTag]
          },
          impact: 1
        });
      }
    }

    // "NOT tag #tagname" pattern
    const notTagMatch = filterDesc.match(/NOT\s+tag\s+#(\w+)/i);
    if (notTagMatch && notTagMatch[1]) {
      const excludeTag = notTagMatch[1]!;
      const currentTags = task.tags || [];
      
      if (currentTags.includes(excludeTag)) {
        fixes.push({
          id: this.generateFixId(),
          taskId: task.id,
          description: `Remove tag #${excludeTag}`,
          type: "remove_tag",
          confidence: 0.95,
          effort: 1,
          targetFilter: filterDesc,
          patch: {
            tags: currentTags.filter(t => t !== excludeTag)
          },
          impact: 1
        });
      }
    }

    return fixes;
  }

  /**
   * Generate status-related fixes
   */
  private generateStatusFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    const statusMatch = filterDesc.match(/status\s*(=|is)\s*(todo|in-progress|done|cancelled)/i);
    if (statusMatch && statusMatch[2]) {
      const targetStatus = statusMatch[2]!.toLowerCase();
      
      fixes.push({
        id: this.generateFixId(),
        taskId: task.id,
        description: `Change status to ${targetStatus}`,
        type: "change_status",
        confidence: 0.85,
        effort: 1,
        targetFilter: filterDesc,
        patch: {
          status: targetStatus
        },
        impact: 1
      });
    }

    return fixes;
  }

  /**
   * Generate dependency-related fixes
   * Note: Task model doesn't have dependencies field - this is for future use
   */
  private generateDependencyFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];
    // Skipped: Task interface doesn't currently support dependencies
    return fixes;
  }

  /**
   * Generate recurrence-related fixes
   */
  private generateRecurrenceFixes(task: Task, filterDesc: string): SuggestedFix[] {
    const fixes: SuggestedFix[] = [];

    // "is recurring" pattern
    if (filterDesc.match(/is\s+recur/i) && !task.recurrence) {
      fixes.push({
        id: this.generateFixId(),
        taskId: task.id,
        description: "Add recurrence rule (manual configuration required)",
        type: "add_field",
        confidence: 0.4,
        effort: 4,
        targetFilter: filterDesc,
        patch: {
          recurrence: "<configure-recurrence>"
        },
        impact: 1
      });
    }

    // "is not recurring" pattern
    if (filterDesc.match(/not\s+recur/i) && task.recurrence) {
      fixes.push({
        id: this.generateFixId(),
        taskId: task.id,
        description: "Remove recurrence rule",
        type: "remove_field",
        confidence: 0.9,
        effort: 1,
        targetFilter: filterDesc,
        patch: {
          recurrence: null
        },
        impact: 1
      });
    }

    return fixes;
  }

  /**
   * Parse date string (simplified)
   */
  private parseDate(dateStr: string): Date | null {
    const now = new Date();
    
    switch (dateStr.toLowerCase()) {
      case "today":
        return now;
      case "tomorrow":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      default:
        const parsed = new Date(dateStr);
        return isNaN(parsed.getTime()) ? null : parsed;
    }
  }

  /**
   * Generate unique fix ID
   */
  private generateFixId(): string {
    return `fix-${++this.fixIdCounter}-${Date.now()}`;
  }

  /**
   * Apply a fix to a task
   */
  static applyFix(task: Task, fix: SuggestedFix): Task {
    return {
      ...task,
      ...fix.patch
    };
  }

  /**
   * Generate markdown report of suggested fixes
   */
  static toMarkdown(fixGroups: FixGroup[]): string {
    const lines: string[] = [];

    lines.push("## Suggested Fixes for Unmatched Tasks");
    lines.push("");
    lines.push(`Found ${fixGroups.length} tasks with suggested fixes.`);
    lines.push("");

    for (const group of fixGroups) {
      lines.push(`### ${group.task.name || group.task.id}`);
      lines.push("");
      
      if (group.quickFixAvailable) {
        lines.push("⚡ **Quick fix available** (high confidence, low effort)");
        lines.push("");
      }

      if (group.bestFix) {
        lines.push("**Recommended Fix:**");
        lines.push(`- ${group.bestFix.description}`);
        lines.push(`  - Confidence: ${(group.bestFix.confidence * 100).toFixed(0)}%`);
        lines.push(`  - Effort: ${"⭐".repeat(group.bestFix.effort)}`);
        lines.push("");
      }

      if (group.fixes.length > 1) {
        lines.push("**Other Options:**");
        for (const fix of group.fixes.slice(1, 4)) {
          lines.push(`- ${fix.description} (${(fix.confidence * 100).toFixed(0)}% confident)`);
        }
        lines.push("");
      }

      lines.push("---");
      lines.push("");
    }

    return lines.join('\n');
  }
}
