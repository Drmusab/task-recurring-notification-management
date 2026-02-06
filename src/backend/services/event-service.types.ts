import type { Frequency } from "@backend/core/models/Frequency";
import type { Task, TaskPriority } from "@backend/core/models/Task";

export type TaskEventType =
  | "task.due"
  | "task.completed"
  | "task.snoozed"
  | "task.skipped"
  | "task.missed"
  | "test.ping";

/**
 * Configuration for n8n webhook
 */
export interface N8nConfig {
  webhookUrl: string;
  sharedSecret: string;
  enabled: boolean;
  /** When true, send raw sharedSecret in X-Shehab-Note-Secret header (deprecated, prefer HMAC) */
  useLegacyAuth?: boolean;
}

/**
 * All notification configuration
 */
export interface NotificationConfig {
  n8n: N8nConfig;
}

export interface EventDelivery {
  dedupeKey: string;
  attempt: number;
}

export interface EventContext {
  timezone: string;
  delayMs?: number;
  previousDueAt?: string;
  nextDueAt?: string;
}

export interface EventRouting {
  escalationLevel: number;
  channels: string[];
}

export interface TaskSnapshot {
  id: string;
  name: string;
  dueAt: string;
  frequency: Frequency;
  linkedBlockId?: string;
  linkedBlockContent?: string;
  priority?: TaskPriority;
  tags?: string[];
  notificationChannels?: string[];
  completionCount?: number;
  missCount?: number;
  currentStreak?: number;
  bestStreak?: number;
}

export interface TaskEventPayload {
  event: TaskEventType;
  source: string;
  version: string;
  occurredAt: string;
  task?: TaskSnapshot;
  context?: EventContext;
  routing?: EventRouting;
  delivery: EventDelivery;
}

export interface QueueItem {
  id: string;
  payload: TaskEventPayload;
  attempt: number;
  nextAttemptAt: string;
}

export function createTaskSnapshot(task: Task): TaskSnapshot {
  return {
    id: task.id,
    name: task.name,
    dueAt: task.dueAt,
    frequency: task.frequency,
    linkedBlockId: task.linkedBlockId,
    linkedBlockContent: task.linkedBlockContent,
    priority: task.priority,
    tags: task.tags,
    notificationChannels: task.notificationChannels,
    completionCount: task.completionCount,
    missCount: task.missCount,
    currentStreak: task.currentStreak,
    bestStreak: task.bestStreak,
  };
}
