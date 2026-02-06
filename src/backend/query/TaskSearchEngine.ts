import type { Task } from "@backend/core/models/Task";
import type { SearchTasksData } from "@backend/commands/types/BulkCommandTypes";

/**
 * TaskSearchEngine handles search and filter operations on tasks.
 */
export class TaskSearchEngine {
  /**
   * Search and filter tasks based on search data criteria.
   */
  search(tasks: Task[], data: SearchTasksData): Task[] {
    let results = [...tasks];

    // Apply text search filter
    if (data.query) {
      const query = data.query.toLowerCase();
      results = results.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query) ||
          t.category?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (data.filters?.status && data.filters.status.length > 0) {
      results = results.filter((t) =>
        t.enabled ? data.filters!.status!.includes("active") : data.filters!.status!.includes("inactive")
      );
    }

    // Apply priority filter
    if (data.filters?.priority && data.filters.priority.length > 0) {
      results = results.filter((t) =>
        t.priority ? data.filters!.priority!.includes(t.priority as "low" | "medium" | "high") : false
      );
    }

    // Apply tag filter
    if (data.filters?.tags && data.filters.tags.length > 0) {
      results = results.filter((t) =>
        data.filters!.tags!.some((tag: string) => t.tags?.includes(tag))
      );
    }

    // Apply sorting
    if (data.sort) {
      const direction = data.sort.order === "desc" ? -1 : 1;
      results.sort((a, b) => {
        const aVal = (a as unknown as Record<string, unknown>)[data.sort!.field] ?? "";
        const bVal = (b as unknown as Record<string, unknown>)[data.sort!.field] ?? "";
        return String(aVal).localeCompare(String(bVal)) * direction;
      });
    }

    return results;
  }
}
