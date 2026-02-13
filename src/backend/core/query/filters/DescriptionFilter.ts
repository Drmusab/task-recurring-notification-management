import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';
import { RegexMatcher } from "@backend/core/query/utils/RegexMatcher";

export class DescriptionFilter extends Filter {
  private compiledRegex?: RegExp;

  constructor(
    private operator: 'includes' | 'does not include' | 'regex',
    private pattern: string,
    private caseSensitive = false
  ) {
    super();
    
    // Pre-compile regex in constructor for better performance
    if (this.operator === 'regex') {
      try {
        const flags = this.caseSensitive ? '' : 'i';
        this.compiledRegex = RegexMatcher.compile({ pattern: this.pattern, flags });
      } catch {
        // If regex compilation fails, we'll return false in matches()
        this.compiledRegex = undefined;
      }
    }
  }

  matches(task: Task): boolean {
    // Search in both task name and description field
    const taskName = task.name || '';
    const taskDescription = task.description || '';
    const combinedText = `${taskName} ${taskDescription}`.trim();
    
    switch (this.operator) {
      case 'includes': {
        const needle = this.caseSensitive ? this.pattern : this.pattern.toLowerCase();
        const haystack = this.caseSensitive ? combinedText : combinedText.toLowerCase();
        return haystack.includes(needle);
      }
      case 'does not include': {
        const needle = this.caseSensitive ? this.pattern : this.pattern.toLowerCase();
        const haystack = this.caseSensitive ? combinedText : combinedText.toLowerCase();
        return !haystack.includes(needle);
      }
      case 'regex': {
        if (!this.compiledRegex) {
          return false;
        }
        return RegexMatcher.test(this.compiledRegex, combinedText);
      }
    }
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    const caseNote = this.caseSensitive ? ' (case-sensitive)' : '';
    if (this.operator === 'regex') {
      return `description matches regex /${this.pattern}/${caseNote}`;
    }
    return `description ${this.operator} "${this.pattern}"${caseNote}`;
  }

  explainMatch(task: Task): string {
    const taskName = task.name || '';
    const taskDescription = task.description || '';
    const combinedText = `${taskName} ${taskDescription}`.trim();
    const preview = combinedText.length > 50 ? combinedText.substring(0, 50) + '...' : combinedText;
    
    if (this.operator === 'regex') {
      return `Task "${task.name}" text "${preview}" matches regex /${this.pattern}/`;
    }
    return `Task "${task.name}" text "${preview}" ${this.operator} "${this.pattern}"`;
  }

  explainMismatch(task: Task): string {
    const taskName = task.name || '';
    const taskDescription = task.description || '';
    const combinedText = `${taskName} ${taskDescription}`.trim();
    const preview = combinedText.length > 50 ? combinedText.substring(0, 50) + '...' : combinedText;
    
    if (this.operator === 'regex') {
      return `Task "${task.name}" text "${preview}" does NOT match regex /${this.pattern}/`;
    }
    const invertedOp = this.operator === 'includes' ? 'does NOT include' : 'includes';
    return `Task "${task.name}" text "${preview}" ${invertedOp} "${this.pattern}"`;
  }
}
