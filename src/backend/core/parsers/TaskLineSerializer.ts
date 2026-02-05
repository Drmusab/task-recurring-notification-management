import type { Task } from '@backend/core/models/Task';
import { EMOJI_SIGNIFIERS, getPriorityEmoji, type TaskFormat } from '@shared/utils/misc/signifiers';
import { normalizePriority } from '@backend/core/models/Task';
import { DateParser } from "@backend/core/parsers/DateParser";

export interface SerializeOptions {
  format: TaskFormat;
  /** Include created date automatically */
  includeCreated?: boolean;
  /** Unknown fields to preserve */
  unknownFields?: string[];
}

export class TaskLineSerializer {
  /**
   * Serialize a Task to a markdown line
   */
  static serialize(task: Task, statusSymbol: string, options: SerializeOptions): string {
    const parts: string[] = [];
    
    // Description
    parts.push(task.name);

    if (options.format === 'emoji') {
      // Priority
      if (task.priority) {
        const normalized = normalizePriority(task.priority) || 'normal';
        const emoji = normalized !== 'normal' ? getPriorityEmoji(normalized) : undefined;
        if (emoji) parts.push(emoji);
      }

      // Recurrence
      if (task.recurrenceText) {
        parts.push(`${EMOJI_SIGNIFIERS.recurrence} ${task.recurrenceText}`);
      }

      // ID
      if (task.id) {
        parts.push(`${EMOJI_SIGNIFIERS.id} ${task.id}`);
      }

      // DependsOn
      if (task.dependsOn && task.dependsOn.length > 0) {
        parts.push(`${EMOJI_SIGNIFIERS.dependsOn} ${task.dependsOn.join(',')}`);
      }

      // Created
      if (task.createdAt && options.includeCreated) {
        parts.push(`${EMOJI_SIGNIFIERS.created} ${DateParser.toISODateString(new Date(task.createdAt))}`);
      }

      // Start
      if (task.startAt) {
        parts.push(`${EMOJI_SIGNIFIERS.start} ${DateParser.toISODateString(new Date(task.startAt))}`);
      }

      // Scheduled
      if (task.scheduledAt) {
        parts.push(`${EMOJI_SIGNIFIERS.scheduled} ${DateParser.toISODateString(new Date(task.scheduledAt))}`);
      }

      // Due
      if (task.dueAt) {
        parts.push(`${EMOJI_SIGNIFIERS.due} ${DateParser.toISODateString(new Date(task.dueAt))}`);
      }

      // Done
      if (task.doneAt && task.status === 'done') {
        parts.push(`${EMOJI_SIGNIFIERS.done} ${DateParser.toISODateString(new Date(task.doneAt))}`);
      }

      // Cancelled
      if (task.cancelledAt && task.status === 'cancelled') {
        parts.push(`${EMOJI_SIGNIFIERS.cancelled} ${DateParser.toISODateString(new Date(task.cancelledAt))}`);
      }

      // OnCompletion
      if (task.onCompletion) {
        parts.push(`${EMOJI_SIGNIFIERS.onCompletion} ${task.onCompletion}`);
      }
    } else {
      // Text format [field:: value]
      if (task.priority) {
        const normalized = normalizePriority(task.priority) || 'normal';
        if (normalized !== 'normal') {
          parts.push(`[priority:: ${normalized}]`);
        }
      }
      if (task.recurrenceText) {
        parts.push(`[repeat:: ${task.recurrenceText}]`);
      }
      if (task.id) {
        parts.push(`[id:: ${task.id}]`);
      }
      if (task.dependsOn && task.dependsOn.length > 0) {
        parts.push(`[dependsOn:: ${task.dependsOn.join(',')}]`);
      }
      if (task.createdAt && options.includeCreated) {
        parts.push(`[created:: ${DateParser.toISODateString(new Date(task.createdAt))}]`);
      }
      if (task.startAt) {
        parts.push(`[start:: ${DateParser.toISODateString(new Date(task.startAt))}]`);
      }
      if (task.scheduledAt) {
        parts.push(`[scheduled:: ${DateParser.toISODateString(new Date(task.scheduledAt))}]`);
      }
      if (task.dueAt) {
        parts.push(`[due:: ${DateParser.toISODateString(new Date(task.dueAt))}]`);
      }
      if (task.doneAt && task.status === 'done') {
        parts.push(`[done:: ${DateParser.toISODateString(new Date(task.doneAt))}]`);
      }
      if (task.cancelledAt && task.status === 'cancelled') {
        parts.push(`[cancelled:: ${DateParser.toISODateString(new Date(task.cancelledAt))}]`);
      }
      if (task.onCompletion) {
        parts.push(`[onCompletion:: ${task.onCompletion}]`);
      }
    }

    // Preserve unknown fields
    const preservedUnknownFields = options.unknownFields ?? task.unknownFields;
    if (preservedUnknownFields && preservedUnknownFields.length > 0) {
      parts.push(...preservedUnknownFields);
    }

    return `- [${statusSymbol}] ${parts.join(' ')}`;
  }
}
