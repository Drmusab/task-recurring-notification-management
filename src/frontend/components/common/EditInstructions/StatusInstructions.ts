// @ts-nocheck
/**
 * StatusInstructions - editing instructions for task status changes.
 */
import type { Task } from "@backend/core/models/Task";
import type { TaskEditingInstruction } from "./TaskEditingInstruction";

export class StatusInstruction implements TaskEditingInstruction {
  constructor(
    private readonly statusName: string,
    private readonly statusSymbol: string,
  ) {}

  instructionDisplayName(): string {
    return this.statusName;
  }

  isCheckedForTask(task: Task): boolean {
    return task.status === this.statusSymbol;
  }

  apply(task: Task): Task[] {
    return [{ ...task, status: this.statusSymbol }];
  }
}

export function allStatusInstructions(): StatusInstruction[] {
  return [
    new StatusInstruction("Todo", " "),
    new StatusInstruction("In Progress", "/"),
    new StatusInstruction("Done", "x"),
    new StatusInstruction("Cancelled", "-"),
  ];
}
