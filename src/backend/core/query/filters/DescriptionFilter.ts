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
}
