import type { Task } from '@backend/core/models/Task';
import { normalizePriority } from '@backend/core/models/Task';
import { Status, StatusType } from '@backend/core/models/Status';
import { StatusRegistry } from '@backend/core/models/StatusRegistry';
import { EMOJI_SIGNIFIERS, type TaskFormat } from "@shared/utils/task/signifiers";
import { DateParser } from '@backend/core/parsers/DateParser';
import { GlobalFilter } from '@backend/core/filtering/GlobalFilter';

export interface ParsedTaskLine {
  task: Partial<Task> | null;
  isValid: boolean;
  isTask: boolean;
  error?: string;
  /** Fields that were not recognized - preserved for lossless serialization */
  unknownFields: string[];
  /** Original line for reference */
  originalLine: string;
  /** Status symbol from checkbox */
  statusSymbol: string;
  /** Description text (without metadata) */
  description: string;
}

export class TaskLineParser {
  private format: TaskFormat;
  private registry: StatusRegistry;
  private globalFilter: GlobalFilter;

  constructor(format: TaskFormat = 'emoji') {
    this.format = format;
    this.registry = StatusRegistry.getInstance();
    this.globalFilter = GlobalFilter.getInstance();
  }

  /**
   * Parse a task line into a Task object
   */
  parse(line: string, filePath?: string): ParsedTaskLine {
    const originalLine = line;
    const unknownFields: string[] = [];

    // Check if line is a task (checkbox pattern)
    const checkboxMatch = line.match(/^(\s*)-\s*\[(.)\]\s*(.*)$/);
    if (!checkboxMatch) {
      return {
        task: null,
        isValid: false,
        isTask: false,
        unknownFields: [],
        originalLine,
        statusSymbol: '',
        description: '',
      };
    }

    const indent = checkboxMatch[1];
    const statusSymbol = checkboxMatch[2];
    let content = checkboxMatch[3];

    // Check global filter AFTER extracting status symbol for better debugging
    if (!this.globalFilter.shouldTreatAsTask(line, filePath)) {
      return {
        task: null,
        isValid: false,
        isTask: false,
        error: 'Excluded by global filter',
        unknownFields: [],
        originalLine,
        statusSymbol,  // Now includes actual status symbol
        description: content.trim(),
      };
    }

    const status = this.registry.get(statusSymbol);
    const task: Partial<Task> = {
      enabled: status.type === StatusType.TODO || status.type === StatusType.IN_PROGRESS,
      status: this.mapStatusType(status.type),
      path: filePath,
    };

    // Extract metadata based on format
    if (this.format === 'emoji') {
      const result = this.parseEmojiFormat(content);
      Object.assign(task, result.metadata);
      content = result.description;
      unknownFields.push(...result.unknownFields);
    } else {
      const result = this.parseTextFormat(content);
      Object.assign(task, result.metadata);
      content = result.description;
      unknownFields.push(...result.unknownFields);
    }

    task.name = content.trim();
    if (unknownFields.length > 0) {
      task.unknownFields = unknownFields;
    }

    return {
      task,
      isValid: true,
      isTask: true,
      unknownFields,
      originalLine,
      statusSymbol,
      description: content.trim(),
    };
  }

  private mapStatusType(type: StatusType): 'todo' | 'done' | 'cancelled' | undefined {
    switch (type) {
      case StatusType.TODO:
      case StatusType.IN_PROGRESS:
        return 'todo';
      case StatusType.DONE:
        return 'done';
      case StatusType.CANCELLED:
        return 'cancelled';
      default:
        return undefined;
    }
  }

  private parseEmojiFormat(content: string): { 
    metadata: Partial<Task>; 
    description: string; 
    unknownFields: string[];
  } {
    const metadata: Partial<Task> = {};
    const unknownFields: string[] = [];
    let description = content;

    const allEmojis = [
      EMOJI_SIGNIFIERS.due,
      EMOJI_SIGNIFIERS.scheduled,
      EMOJI_SIGNIFIERS.start,
      EMOJI_SIGNIFIERS.created,
      EMOJI_SIGNIFIERS.done,
      EMOJI_SIGNIFIERS.cancelled,
      EMOJI_SIGNIFIERS.id,
      EMOJI_SIGNIFIERS.dependsOn,
      EMOJI_SIGNIFIERS.onCompletion,
      EMOJI_SIGNIFIERS.recurrence,
      ...Object.values(EMOJI_SIGNIFIERS.priority),
    ];
    const emojiPattern = allEmojis
      .map((emoji) => emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');

    type DateField = "dueAt" | "scheduledAt" | "startAt" | "createdAt" | "doneAt" | "cancelledAt";
    const parseDateField = (signifier: string, field: DateField, setCompletion = false) => {
      const match = content.match(
        new RegExp(`${signifier}\\s*([^\\s].*?)(?=\\s(?:${emojiPattern}|#)|$)`)
      );
      if (!match) return;
      const parsed = DateParser.parse(match[1].trim());
      if (parsed.isValid && parsed.date) {
        metadata[field] = parsed.date.toISOString();
        if (setCompletion) {
          metadata.lastCompletedAt = parsed.date.toISOString();
        }
      } else {
        unknownFields.push(match[0]);
      }
      description = description.replace(match[0], '');
    };

    // Due date: 📅 <date>
    parseDateField(EMOJI_SIGNIFIERS.due, "dueAt");

    // Scheduled date: ⏳ <date>
    parseDateField(EMOJI_SIGNIFIERS.scheduled, "scheduledAt");

    // Start date: 🛫 <date>
    parseDateField(EMOJI_SIGNIFIERS.start, "startAt");

    // Created date: ➕ <date>
    parseDateField(EMOJI_SIGNIFIERS.created, "createdAt");

    // Done date: ✅ <date>
    parseDateField(EMOJI_SIGNIFIERS.done, "doneAt", true);

    // Cancelled date: ❌ <date>
    parseDateField(EMOJI_SIGNIFIERS.cancelled, "cancelledAt");

    // OnCompletion: 🏁 keep/delete
    const onCompletionMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.onCompletion}\\s*(keep|delete)`));
    if (onCompletionMatch) {
      metadata.onCompletion = onCompletionMatch[1] as 'keep' | 'delete';
      description = description.replace(onCompletionMatch[0], '');
    }

    // Recurrence: 🔁 <rule>
    // Match until we hit another emoji signifier or tag
    const recurrenceMatch = content.match(
      new RegExp(`${EMOJI_SIGNIFIERS.recurrence}\\s*([^\\s].*?)(?=\\s(?:${emojiPattern}|#)|$)`)
    );
    if (recurrenceMatch) {
      metadata.recurrenceText = recurrenceMatch[1].trim();
      description = description.replace(recurrenceMatch[0], '');
    }

    // Priority
    for (const [name, emoji] of Object.entries(EMOJI_SIGNIFIERS.priority)) {
      if (content.includes(emoji)) {
        const normalized = normalizePriority(name);
        if (normalized) {
          metadata.priority = normalized;
        }
        description = description.replace(emoji, '');
        break;
      }
    }

    // ID: 🆔 <id>
    const idMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.id}\\s*(\\S+)`));
    if (idMatch) {
      metadata.id = idMatch[1];
      description = description.replace(idMatch[0], '');
    }

    // DependsOn: ⛔ <id1>,<id2>
    const dependsMatch = content.match(new RegExp(`${EMOJI_SIGNIFIERS.dependsOn}\\s*([\\w,_-]+)`));
    if (dependsMatch) {
      metadata.dependsOn = dependsMatch[1].split(',').map(s => s.trim());
      description = description.replace(dependsMatch[0], '');
    }

    // Tags: #tag
    const tagMatches = content.match(/#[\w\/-]+/g);
    if (tagMatches) {
      metadata.tags = tagMatches;
      // Remove tags from description
      for (const tag of tagMatches) {
        description = description.replace(tag, '');
      }
    }

    return { metadata, description: description.trim(), unknownFields };
  }

  private parseTextFormat(content: string): { 
    metadata: Partial<Task>; 
    description: string; 
    unknownFields: string[];
  } {
    // Similar to emoji format but for [field:: value] syntax
    const metadata: Partial<Task> = {};
    const unknownFields: string[] = [];
    let description = content;

    // Extract [key:: value] patterns
    const fieldPattern = /\[(\w+)::\s*([^\]]+)\]/g;
    let match;
    
    while ((match = fieldPattern.exec(content)) !== null) {
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      
      const parseDateValue = (valueToParse: string) => {
        const parsed = DateParser.parse(valueToParse);
        return parsed.isValid && parsed.date ? parsed.date.toISOString() : null;
      };

      switch (key) {
        case 'due':
          metadata.dueAt = parseDateValue(value) ?? undefined;
          if (!metadata.dueAt) unknownFields.push(match[0]);
          break;
        case 'scheduled':
          metadata.scheduledAt = parseDateValue(value) ?? undefined;
          if (!metadata.scheduledAt) unknownFields.push(match[0]);
          break;
        case 'start':
          metadata.startAt = parseDateValue(value) ?? undefined;
          if (!metadata.startAt) unknownFields.push(match[0]);
          break;
        case 'created':
          metadata.createdAt = parseDateValue(value) ?? undefined;
          if (!metadata.createdAt) unknownFields.push(match[0]);
          break;
        case 'done':
          metadata.doneAt = parseDateValue(value) ?? undefined;
          if (metadata.doneAt) {
            // Also set lastCompletedAt for backward compatibility
            metadata.lastCompletedAt = metadata.doneAt;
          } else {
            unknownFields.push(match[0]);
          }
          break;
        case 'cancelled':
          metadata.cancelledAt = parseDateValue(value) ?? undefined;
          if (!metadata.cancelledAt) unknownFields.push(match[0]);
          break;
        case 'repeat':
          metadata.recurrenceText = value;
          break;
        case 'oncompletion':
          metadata.onCompletion = value as 'keep' | 'delete';
          break;
        case 'priority': {
          const normalized = normalizePriority(value);
          if (normalized) {
            metadata.priority = normalized;
          } else {
            unknownFields.push(match[0]);
          }
          break;
        }
        case 'id':
          metadata.id = value;
          break;
        case 'dependson':
          metadata.dependsOn = value.split(',').map(s => s.trim());
          break;
        default:
          unknownFields.push(match[0]);
      }
      
      description = description.replace(match[0], '');
    }

    // Tags
    const tagMatches = content.match(/#[\w\/-]+/g);
    if (tagMatches) {
      metadata.tags = tagMatches;
      // Remove tags from description
      for (const tag of tagMatches) {
        description = description.replace(tag, '');
      }
    }

    return { metadata, description: description.trim(), unknownFields };
  }
}
