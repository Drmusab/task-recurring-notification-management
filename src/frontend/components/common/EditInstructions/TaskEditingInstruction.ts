import type { Task } from "@backend/core/models/Task";

/**
 * Interface for task editing instructions used by TaskEditingMenu.
 */
export interface TaskEditingInstruction {
  /** Display name shown in menu */
  instructionDisplayName(): string;
  /** Whether this instruction is currently active/checked for the given task */
  isCheckedForTask(task: Task): boolean;
  /** Apply instruction and return the resulting task(s) */
  apply(task: Task): Task[];
}
