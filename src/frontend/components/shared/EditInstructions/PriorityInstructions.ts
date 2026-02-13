import type { Task } from "@backend/core/models/Task";
import type { TaskEditingInstruction } from "./TaskEditingInstruction";

/**
 * Get all priority editing instructions for a task.
 */
export function allPriorityInstructions(_task: Task): TaskEditingInstruction[] {
  return [];
}
