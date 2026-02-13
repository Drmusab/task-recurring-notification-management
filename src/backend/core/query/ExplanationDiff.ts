/**
 * ExplanationDiff - Compare query explanations before/after changes
 * 
 * Analyzes the difference between two query explanations to show:
 * - Tasks that became matched/unmatched
 * - Filter changes that caused the difference
 * - Specific reasons for each change
 * 
 * Phase 4: Explanation Enhancements
 * 
 * @module ExplanationDiff
 */

import type { Explanation, TaskExplanation } from "./QueryExplainer";
import type { Task } from "@backend/core/models/Task";

export interface ExplanationDiff {
  /** Tasks that were matched before but not after */
  nowUnmatched: TaskDiffEntry[];
  /** Tasks that were unmatched before but matched after */
  nowMatched: TaskDiffEntry[];
  /** Tasks still matched (reasons may have changed) */
  stillMatched: TaskDiffEntry[];
  /** Tasks still unmatched (reasons may have changed) */
  stillUnmatched: TaskDiffEntry[];
  /** Overall change summary */
  summary: DiffSummary;
}

export interface TaskDiffEntry {
  task: Task;
  beforeReasons: string[];
  afterReasons: string[];
  reasonsChanged: boolean;
}

export interface DiffSummary {
  totalTasks: number;
  beforeMatchCount: number;
  afterMatchCount: number;
  matchCountChange: number;
  gainedMatches: number;
  lostMatches: number;
  reasonsChangedCount: number;
  impactLevel: "none" | "minor" | "moderate" | "major";
}

export interface FilterChange {
  type: "added" | "removed" | "modified";
  filter: string;
  impact: number; // Number of tasks affected
}

/**
 * Compares two query explanations and generates a detailed diff
 */
export class ExplanationDiff {
  /**
   * Generate diff between two explanations
   */
  static diff(before: Explanation, after: Explanation): ExplanationDiff {
    // Build task maps for efficient lookup
    const beforeMatchedMap = new Map<string, TaskExplanation>();
    const beforeUnmatchedMap = new Map<string, TaskExplanation>();
    const afterMatchedMap = new Map<string, TaskExplanation>();
    const afterUnmatchedMap = new Map<string, TaskExplanation>();

    before.taskExplanations.forEach((te: TaskExplanation) => {
      if (te.matched) {
        beforeMatchedMap.set(te.task.id, te);
      } else {
        beforeUnmatchedMap.set(te.task.id, te);
      }
    });
    
    after.taskExplanations.forEach((te: TaskExplanation) => {
      if (te.matched) {
        afterMatchedMap.set(te.task.id, te);
      } else {
        afterUnmatchedMap.set(te.task.id, te);
      }
    });

    // Categorize changes
    const nowUnmatched: TaskDiffEntry[] = [];
    const nowMatched: TaskDiffEntry[] = [];
    const stillMatched: TaskDiffEntry[] = [];
    const stillUnmatched: TaskDiffEntry[] = [];

    // Check all tasks from before
    const allTaskIds = new Set([
      ...beforeMatchedMap.keys(),
      ...beforeUnmatchedMap.keys(),
      ...afterMatchedMap.keys(),
      ...afterUnmatchedMap.keys()
    ]);

    for (const taskId of allTaskIds) {
      const wasMatched = beforeMatchedMap.has(taskId);
      const isMatched = afterMatchedMap.has(taskId);

      const beforeEntry = beforeMatchedMap.get(taskId) || beforeUnmatchedMap.get(taskId);
      const afterEntry = afterMatchedMap.get(taskId) || afterUnmatchedMap.get(taskId);

      if (!beforeEntry || !afterEntry) continue;

      const beforeReasons = beforeEntry.mismatchReasons || [];
      const afterReasons = afterEntry.mismatchReasons || [];
      const reasonsChanged = !this.arraysEqual(beforeReasons, afterReasons);

      const diffEntry: TaskDiffEntry = {
        task: beforeEntry.task,
        beforeReasons,
        afterReasons,
        reasonsChanged
      };

      if (wasMatched && !isMatched) {
        nowUnmatched.push(diffEntry);
      } else if (!wasMatched && isMatched) {
        nowMatched.push(diffEntry);
      } else if (wasMatched && isMatched) {
        stillMatched.push(diffEntry);
      } else {
        stillUnmatched.push(diffEntry);
      }
    }

    // Generate summary
    const summary = this.generateSummary(before, after, nowMatched, nowUnmatched, stillMatched, stillUnmatched);

    return {
      nowUnmatched,
      nowMatched,
      stillMatched,
      stillUnmatched,
      summary
    };
  }

  /**
   * Analyze filter changes between queries
   */
  static analyzeFilterChanges(beforeQuery: string, afterQuery: string): FilterChange[] {
    const changes: FilterChange[] = [];

    // Simple line-based comparison (can be enhanced with AST diff)
    const beforeLines = beforeQuery.split('\n').map(l => l.trim()).filter(Boolean);
    const afterLines = afterQuery.split('\n').map(l => l.trim()).filter(Boolean);

    const beforeSet = new Set(beforeLines);
    const afterSet = new Set(afterLines);

    // Removed filters
    for (const line of beforeLines) {
      if (!afterSet.has(line)) {
        changes.push({
          type: "removed",
          filter: line,
          impact: 0 // Will be calculated by caller
        });
      }
    }

    // Added filters
    for (const line of afterLines) {
      if (!beforeSet.has(line)) {
        changes.push({
          type: "added",
          filter: line,
          impact: 0
        });
      }
    }

    return changes;
  }

  /**
   * Generate markdown report of the diff
   */
  static toMarkdown(diff: ExplanationDiff): string {
    const lines: string[] = [];

    lines.push("## Query Explanation Diff");
    lines.push("");

    // Summary
    lines.push("### Summary");
    lines.push(`- **Total Tasks**: ${diff.summary.totalTasks}`);
    lines.push(`- **Before**: ${diff.summary.beforeMatchCount} matched`);
    lines.push(`- **After**: ${diff.summary.afterMatchCount} matched`);
    lines.push(`- **Change**: ${diff.summary.matchCountChange > 0 ? '+' : ''}${diff.summary.matchCountChange} tasks`);
    lines.push(`- **Impact**: ${diff.summary.impactLevel.toUpperCase()}`);
    lines.push("");

    // Gained matches
    if (diff.nowMatched.length > 0) {
      lines.push(`### ✅ Newly Matched (${diff.nowMatched.length})`);
      lines.push("");
      for (const entry of diff.nowMatched) {
        lines.push(`- **${entry.task.name || entry.task.id}**`);
        lines.push(`  - Before: Not matched - ${entry.beforeReasons.join('; ')}`);
        lines.push(`  - After: Matched - ${entry.afterReasons.join('; ')}`);
      }
      lines.push("");
    }

    // Lost matches
    if (diff.nowUnmatched.length > 0) {
      lines.push(`### ❌ No Longer Matched (${diff.nowUnmatched.length})`);
      lines.push("");
      for (const entry of diff.nowUnmatched) {
        lines.push(`- **${entry.task.name || entry.task.id}**`);
        lines.push(`  - Before: Matched - ${entry.beforeReasons.join('; ')}`);
        lines.push(`  - After: Not matched - ${entry.afterReasons.join('; ')}`);
      }
      lines.push("");
    }

    // Changed reasons (still matched)
    const changedMatched = diff.stillMatched.filter(e => e.reasonsChanged);
    if (changedMatched.length > 0) {
      lines.push(`### 🔄 Still Matched, Reasons Changed (${changedMatched.length})`);
      lines.push("");
      for (const entry of changedMatched) {
        lines.push(`- **${entry.task.name || entry.task.id}**`);
        lines.push(`  - Before: ${entry.beforeReasons.join('; ')}`);
        lines.push(`  - After: ${entry.afterReasons.join('; ')}`);
      }
      lines.push("");
    }

    return lines.join('\n');
  }

  /**
   * Get a concise summary text
   */
  static getSummaryText(diff: ExplanationDiff): string {
    const parts: string[] = [];

    if (diff.summary.gainedMatches > 0) {
      parts.push(`+${diff.summary.gainedMatches} matched`);
    }

    if (diff.summary.lostMatches > 0) {
      parts.push(`-${diff.summary.lostMatches} matched`);
    }

    if (diff.summary.reasonsChangedCount > 0) {
      parts.push(`${diff.summary.reasonsChangedCount} reasons changed`);
    }

    if (parts.length === 0) {
      return "No changes";
    }

    return parts.join(', ');
  }

  /**
   * Check if two arrays are equal (order-independent)
   */
  private static arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;

    const sortedA = [...a].sort();
    const sortedB = [...b].sort();

    return sortedA.every((val, idx) => val === sortedB[idx]);
  }

  /**
   * Generate summary statistics
   */
  private static generateSummary(
    before: Explanation,
    after: Explanation,
    nowMatched: TaskDiffEntry[],
    nowUnmatched: TaskDiffEntry[],
    stillMatched: TaskDiffEntry[],
    stillUnmatched: TaskDiffEntry[]
  ): DiffSummary {
    const totalTasks = before.totalCount;
    const beforeMatchCount = before.matchCount;
    const afterMatchCount = after.matchCount;
    const matchCountChange = afterMatchCount - beforeMatchCount;

    const reasonsChangedCount = [...stillMatched, ...stillUnmatched]
      .filter(e => e.reasonsChanged)
      .length;

    // Determine impact level
    let impactLevel: DiffSummary["impactLevel"] = "none";
    const changePercentage = totalTasks > 0 ? Math.abs(matchCountChange) / totalTasks : 0;

    if (changePercentage === 0 && reasonsChangedCount === 0) {
      impactLevel = "none";
    } else if (changePercentage < 0.1) {
      impactLevel = "minor";
    } else if (changePercentage < 0.3) {
      impactLevel = "moderate";
    } else {
      impactLevel = "major";
    }

    return {
      totalTasks,
      beforeMatchCount,
      afterMatchCount,
      matchCountChange,
      gainedMatches: nowMatched.length,
      lostMatches: nowUnmatched.length,
      reasonsChangedCount,
      impactLevel
    };
  }

  /**
   * Get tasks most affected by the change
   */
  static getMostAffectedTasks(diff: ExplanationDiff, limit: number = 10): TaskDiffEntry[] {
    const allChanges = [
      ...diff.nowMatched.map(e => ({ ...e, severity: 3 })),
      ...diff.nowUnmatched.map(e => ({ ...e, severity: 3 })),
      ...diff.stillMatched.filter(e => e.reasonsChanged).map(e => ({ ...e, severity: 1 })),
      ...diff.stillUnmatched.filter(e => e.reasonsChanged).map(e => ({ ...e, severity: 1 }))
    ];

    return allChanges
      .sort((a, b) => b.severity - a.severity)
      .slice(0, limit)
      .map(({ severity, ...entry }) => entry);
  }
}
