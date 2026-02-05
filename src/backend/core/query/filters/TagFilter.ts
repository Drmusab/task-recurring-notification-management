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
}

export class HasTagsFilter extends Filter {
  constructor(private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const hasTags = task.tags && task.tags.length > 0;
    return this.negate ? !hasTags : !!hasTags;
  }
}
