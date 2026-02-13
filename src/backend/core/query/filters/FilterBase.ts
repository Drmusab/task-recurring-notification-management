import type { Task } from '@backend/core/models/Task';

/**
 * Base class for all filters
 */
export abstract class Filter {
  abstract matches(task: Task): boolean;
  
  /**
   * Return human-readable description of what this filter does
   * Example: "priority >= high" or "due before today"
   * 
   * Phase 1: Query Enhancement - Explanation Support
   */
  explain(): string {
    return this.constructor.name;
  }
  
  /**
   * Explain why a specific task matched this filter
   * Example: "Task 'Buy milk' has priority HIGH (≥ HIGH)"
   * 
   * Phase 1: Query Enhancement - Explanation Support
   */
  explainMatch(task: Task): string {
    return `Task "${task.name}" matched ${this.constructor.name}`;
  }
  
  /**
   * Explain why a specific task did NOT match this filter
   * Example: "Task 'Walk dog' has priority MEDIUM (< HIGH)"
   * 
   * Phase 1: Query Enhancement - Explanation Support
   */
  explainMismatch(task: Task): string {
    return `Task "${task.name}" did not match ${this.constructor.name}`;
  }
}
