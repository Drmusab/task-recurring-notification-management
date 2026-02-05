import { Filter } from "@backend/core/query/filters/FilterBase";
import type { Task } from '@backend/core/models/Task';

export class AndFilter extends Filter {
  constructor(private left: Filter, private right: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return this.left.matches(task) && this.right.matches(task);
  }
}

export class OrFilter extends Filter {
  constructor(private left: Filter, private right: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return this.left.matches(task) || this.right.matches(task);
  }
}

export class NotFilter extends Filter {
  constructor(private inner: Filter) {
    super();
  }

  matches(task: Task): boolean {
    return !this.inner.matches(task);
  }
}
