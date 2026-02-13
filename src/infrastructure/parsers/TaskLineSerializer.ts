/**
 * Task Line Serializer - Lossless Round-Trip
 * Converts Task object back to task line string
 * Preserves unknown fields and original formatting
 */

import type { Task } from '../../domain/models/Task';
import type { Settings } from '../../domain/models/Settings';
import {StatusRegistry } from '../../domain/models/TaskStatus';

/**
 * Task Line Serializer
 */
export class TaskLineSerializer {
  private statusRegistry: StatusRegistry;
  private settings: Settings;
  
  constructor(settings: Settings) {
    this.statusRegistry = StatusRegistry.getInstance();
    this.settings = settings;
  }
  
  /**
   * Serialize task to task line string
   */
  serialize(task: Task): string {
    const parts: string[] = [];
    
    // 1. Checkbox
    const symbol = task.statusSymbol || ' ';
    parts.push(`- [${symbol}]`);
    
    // 2. Task name
    parts.push(task.name);
    
    // 3. Date fields
    if (task.dueAt) {
      parts.push(this.formatDateField('due', task.dueAt));
    }
    
    if (task.scheduledAt) {
      parts.push(this.formatDateField('scheduled', task.scheduledAt));
    }
    
    if (task.startAt) {
      parts.push(this.formatDateField('start', task.startAt));
    }
    
    // 4. Recurrence
    if (task.recurrenceText) {
      parts.push(this.formatField('recurs', task.recurrenceText));
    }
    
    // 5. Priority
    if (task.priority && task.priority !== 'none') {
      parts.push(this.formatPriorityField(task.priority));
    }
    
    // 6. Task ID
    if (task.taskId) {
      parts.push(this.formatField('id', task.taskId));
    }
    
    // 7. Dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      task.dependsOn.forEach(depId => {
        parts.push(this.formatField('dependsOn', depId));
      });
    }
    
    // 8. Completion action
    if (task.onCompletion) {
      const action = typeof task.onCompletion === 'string' 
        ? task.onCompletion 
        : task.onCompletion.action;
      parts.push(this.formatField('onCompletion', action));
    }
    
    // 9. Tags (inline #tags - already in name, but add extras if any)
    if (task.tags && task.tags.length > 0) {
      // Only add tags not already in the name
      const tagsInName = (task.name.match(/#\w+/g) || []).map(t => t.slice(1));
      const extraTags = task.tags.filter(tag => !tagsInName.includes(tag));
      
      extraTags.forEach(tag => {
        parts.push(`#${tag}`);
      });
    }
    
    // 10. Unknown fields (for lossless round-trip)
    if (task.unknownFields && task.unknownFields.length > 0) {
      parts.push(...task.unknownFields);
    }
    
    return parts.join(' ');
  }
  
  /**
   * Format a date field based on user preference
   */
  private formatDateField(field: string, date: string): string {
    const formattedDate = this.formatDate(date);
    return this.formatField(field, formattedDate);
  }
  
  /**
   * Format a generic field based on user preference (emoji vs text)
   */
  private formatField(field: string, value: string): string {
    if (this.settings.preferredFormat === 'emoji') {
      return this.formatEmojiField(field, value);
    } else {
      return this.formatTextField(field, value);
    }
  }
  
  /**
   * Format field as emoji signifier
   */
  private formatEmojiField(field: string, value: string): string {
    const emojiMap: Record<string, string> = {
      'due': '📅',
      'scheduled': '⏳',
      'start': '🛫',
      'recurs': '🔁',
      'id': '🆔',
      'dependsOn': '⛔',
      'onCompletion': '🏁',
    };
    
    const emoji = emojiMap[field];
    return emoji ? `${emoji} ${value}` : `${field}:: ${value}`;
  }
  
  /**
   * Format field as text signifier
   */
  private formatTextField(field: string, value: string): string {
    return `${field}:: ${value}`;
  }
  
  /**
   * Format priority field
   */
  private formatPriorityField(priority: string): string {
    if (this.settings.preferredFormat === 'emoji') {
      const priorityEmojiMap: Record<string, string> = {
        'highest': '⏫',
        'high': '🔼',
        'medium': '🔺',
        'low': '🔽',
        'lowest': '⏬',
      };
      
      const emoji = priorityEmojiMap[priority];
      return emoji || `priority:: ${priority}`;
    } else {
      return `priority:: ${priority}`;
    }
  }
  
  /**
   * Format date based on user preferences
   */
  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    
    switch (this.settings.dateFormat) {
      case 'YYYY-MM-DD':
        return dateString.split('T')[0] || dateString; // ISO date only
        
      case 'MM/DD/YYYY':
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
        
      case 'DD/MM/YYYY':
        return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
        
      case 'relative':
        return this.formatRelativeDate(date);
        
      default:
        return dateString.split('T')[0] || dateString;
    }
  }
  
  /**
   * Format date as relative string (e.g., "tomorrow", "in 3 days")
   */
  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'tomorrow';
    if (diffDays === -1) return 'yesterday';
    if (diffDays > 1 && diffDays <= 7) return `in ${diffDays} days`;
    if (diffDays < -1 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    
    // Fall back to ISO date for dates > 1 week away
    return date.toISOString().split('T')[0] || date.toISOString();
  }
}

/**
 * Verify lossless round-trip
 * Parse → Serialize → Parse should yield identical task
 */
export function verifyRoundTrip(originalLine: string, parser: any, serializer: TaskLineSerializer): boolean {
  // Parse original
  const task1 = parser.parse(originalLine);
  
  // Serialize
  const serialized = serializer.serialize(task1);
  
  // Parse again
  const task2 = parser.parse(serialized);
  
  // Compare key fields (ignore timestamps that change)
  const fieldsToCompare = [
    'name',
    'status',
    'statusSymbol',
    'dueAt',
    'scheduledAt',
    'startAt',
    'recurrenceText',
    'priority',
    'taskId',
    'tags',
  ];
  
  for (const field of fieldsToCompare) {
    const val1 = (task1 as any)[field];
    const val2 = (task2 as any)[field];
    
    // Deep equality for arrays
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (val1.length !== val2.length) return false;
      if (!val1.every((v, i) => v === val2[i])) return false;
    }
    // Simple equality for primitives
    else if (val1 !== val2) {
      return false;
    }
  }
  
  return true;
}
