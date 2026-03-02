import type { StatusRegistry } from "@shared/constants/statuses/StatusRegistry";
import type { TaskEditingInstruction } from "./TaskEditingInstruction";

/**
 * Get all status editing instructions for a task, based on the StatusRegistry.
 */
export function allStatusInstructions(_statusRegistry: StatusRegistry): TaskEditingInstruction[] {
  return [];
}
