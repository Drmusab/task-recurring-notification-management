import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class TagIncludesFilter extends Filter {
  constructor(private tag: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const tags = task.tags || [];
    const normalizedTag = this.tag.toLowerCase();
    const result = tags.some(t => t.toLowerCase().includes(normalizedTag));
    return this.negate ? !result : result;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? `does NOT include tag "${this.tag}"` : `includes tag "${this.tag}"`;
  }

  explainMatch(task: Task): string {
    const tags = task.tags || [];
    const matchingTags = tags.filter(t => t.toLowerCase().includes(this.tag.toLowerCase()));
    if (this.negate) {
      return `Task "${task.name}" has tags [${tags.join(', ')}] which do NOT include "${this.tag}"`;
    }
    return `Task "${task.name}" has tag(s) [${matchingTags.join(', ')}] matching "${this.tag}"`;
  }

  explainMismatch(task: Task): string {
    const tags = task.tags || [];
    if (this.negate) {
      const matchingTags = tags.filter(t => t.toLowerCase().includes(this.tag.toLowerCase()));
      return `Task "${task.name}" has tag(s) [${matchingTags.join(', ')}] matching "${this.tag}" (expected no match)`;
    }
    return `Task "${task.name}" has tags [${tags.join(', ') || 'none'}] which do NOT include "${this.tag}"`;
  }
}

export class HasTagsFilter extends Filter {
  constructor(private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const hasTags = task.tags && task.tags.length > 0;
    return this.negate ? !hasTags : !!hasTags;
  }

  // Phase 1: Query Enhancement - Explanation Support
  explain(): string {
    return this.negate ? 'has NO tags' : 'has tags';
  }

  explainMatch(task: Task): string {
    if (this.negate) {
      return `Task "${task.name}" has no tags`;
    }
    const tags = task.tags || [];
    return `Task "${task.name}" has tags [${tags.join(', ')}]`;
  }

  explainMismatch(task: Task): string {
    if (this.negate) {
      const tags = task.tags || [];
      return `Task "${task.name}" has tags [${tags.join(', ')}] (expected no tags)`;
    }
    return `Task "${task.name}" has no tags (expected tags)`;
  }
}
