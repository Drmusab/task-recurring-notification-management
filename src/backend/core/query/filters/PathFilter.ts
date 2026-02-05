import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class PathFilter extends Filter {
  constructor(private pattern: string, private negate = false) {
    super();
  }

  matches(task: Task): boolean {
    const path = task.path || '';
    const result = path.toLowerCase().includes(this.pattern.toLowerCase());
    return this.negate ? !result : result;
  }
}
