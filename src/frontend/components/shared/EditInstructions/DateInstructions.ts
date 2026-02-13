import type { Task } from "@backend/core/models/Task";
import type { AllTaskDateFields } from "@shared/utils/dateTime/date-field-types";
import type { TaskEditingInstruction } from "./TaskEditingInstruction";

/**
 * Instruction to set a task date field to a specific value.
 */
export class SetTaskDate implements TaskEditingInstruction {
  private readonly field: AllTaskDateFields;
  private readonly date: Date;

  constructor(field: AllTaskDateFields, date: Date) {
    this.field = field;
    this.date = date;
  }

  instructionDisplayName(): string {
    return `Set ${String(this.field)}`;
  }

  isCheckedForTask(_task: Task): boolean {
    return false;
  }

  apply(task: Task): Task[] {
    return [{ ...task, [this.field]: this.date.toISOString() }];
  }
}

/**
 * Instruction to remove a task date field.
 */
export class RemoveTaskDate implements TaskEditingInstruction {
  private readonly field: AllTaskDateFields;

  constructor(field: AllTaskDateFields, _task: Task) {
    this.field = field;
  }

  instructionDisplayName(): string {
    return `Remove ${String(this.field)}`;
  }

  isCheckedForTask(_task: Task): boolean {
    return false;
  }

  apply(task: Task): Task[] {
    const result = { ...task };
    delete (result as Record<string, unknown>)[this.field as string];
    return [result];
  }
}

/**
 * Get all date instructions for "happens" date fields (dueAt, etc.)
 */
export function allHappensDateInstructions(
  _field: AllTaskDateFields,
  _task: Task
): TaskEditingInstruction[] {
  return [];
}

/**
 * Get all date instructions for lifecycle date fields (createdAt, completedAt, etc.)
 */
export function allLifeCycleDateInstructions(
  _field: AllTaskDateFields,
  _task: Task
): TaskEditingInstruction[] {
  return [];
}
