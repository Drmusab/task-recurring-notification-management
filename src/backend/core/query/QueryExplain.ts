// @ts-nocheck
import type { FilterNode, QueryAST } from "@backend/core/query/QueryParser";

export function explainQuery(query: QueryAST): string {
  const parts: string[] = [];

  if (query.filters.length > 0) {
    parts.push('**Filters:**');
    for (const filter of query.filters) {
      parts.push(`- ${explainFilter(filter)}`);
    }
  } else {
    parts.push('**Filters:** None (showing all tasks)');
  }

  if (query.sort) {
    const direction = query.sort.reverse ? 'descending' : 'ascending';
    parts.push(`\n**Sort:** By ${query.sort.field} (${direction})`);
  }

  if (query.group) {
    parts.push(`\n**Group:** By ${query.group.field}`);
  }

  if (query.limit !== undefined && query.limit > 0) {
    parts.push(`\n**Limit:** First ${query.limit} tasks`);
  }

  return parts.join('\n');
}

export function explainFilter(filter: FilterNode): string {
  const negate = filter.negate ? 'NOT ' : '';
  const escalationLabel =
    typeof filter.value === "number"
      ? { 0: "on-time", 1: "warning", 2: "critical", 3: "severe" }[filter.value] ?? filter.value
      : filter.value;

  switch (filter.type) {
    case 'status':
      return `${negate}Status ${filter.operator} "${filter.value}"`;

    case 'date':
      return `${negate}${filter.value.field} ${filter.value.comparator} ${filter.value.date}`;

    case 'priority':
      return `${negate}Priority ${filter.operator} ${filter.value}`;

    case 'urgency':
      return `${negate}Urgency ${filter.operator} ${filter.value}`;

    case 'escalation':
      return `${negate}Escalation ${filter.operator} ${escalationLabel}`;

    case 'attention':
      return `${negate}Attention ${filter.operator} ${filter.value}`;

    case 'attention-lane':
      return `${negate}Lane is ${filter.value}`;

    case 'tag':
      if (filter.operator === 'includes') {
        return `${negate}Tag includes "${filter.value}"`;
      }
      if (filter.operator === 'has') {
        return `${negate}Has tags`;
      }
      return `${negate}Tag ${filter.operator} "${filter.value}"`;

    case 'path':
      return `${negate}Path ${filter.operator} "${filter.value}"`;

    case 'dependency':
      if (filter.value === 'blocked') {
        return `${negate}Is blocked by another task`;
      }
      if (filter.value === 'blocking') {
        return `${negate}Is blocking another task`;
      }
      return `${negate}Dependency ${filter.operator} ${filter.value}`;

    case 'recurrence':
      return `${negate}Recurrence ${filter.operator} ${filter.value}`;

    case 'boolean':
      if (filter.operator === 'AND' || filter.operator === 'and') {
        return `(${explainFilter(filter.left!)} AND ${explainFilter(filter.right!)})`;
      }
      if (filter.operator === 'OR' || filter.operator === 'or') {
        return `(${explainFilter(filter.left!)} OR ${explainFilter(filter.right!)})`;
      }
      if (filter.operator === 'NOT' || filter.operator === 'not') {
        return `(NOT ${explainFilter(filter.inner!)})`;
      }
      return 'Unknown boolean filter';

    case 'done':
      return filter.value ? `${negate}done` : `${negate}not done`;

    case 'description':
      return `${negate}Description ${filter.operator} "${filter.value}"`;

    default:
      return `${negate}Unknown filter`;
  }
}
