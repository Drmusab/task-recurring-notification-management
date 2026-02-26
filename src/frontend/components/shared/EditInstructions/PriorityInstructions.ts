import type { TaskDTO } from '../../../services/DTOs';
type Task = TaskDTO;
import type { TaskEditingInstruction } from "./TaskEditingInstruction";

/**
 * Get all priority editing instructions for a task.
 */
export function allPriorityInstructions(_task: Task): TaskEditingInstruction[] {
  return [];
}
