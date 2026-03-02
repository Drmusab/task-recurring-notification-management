/**
 * DomainMapper — Persistence Serialization / Deserialization
 *
 * Converts between DomainTask (frozen, branded types) and
 * plain persistence records (JSON-safe objects for storage).
 *
 * Lifecycle:
 *   DomainTask → toPersistence() → TaskStorage.save()
 *   TaskStorage.load() → fromPersistence() → DomainTask (frozen)
 *
 * Design decisions:
 *   - toPersistence strips __brand from branded types (they're just strings)
 *   - fromPersistence delegates to TaskFactory.fromStorage for construction
 *   - Handles undefined → deletion: undefined fields are omitted from persistence
 *   - never imports Storage, Scheduler, EventBus, SiYuan API, DOM, Service
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Mutate DomainTask
 *   ❌ Add runtime-only fields to persistence (lifecycleState is derived)
 */

import type { DomainTask } from "./DomainTask";
import type { TaskAnalyticsSnapshot } from "./TaskAnalytics";
import type { DependencyLink } from "./DependencyLink";
import type { Recurrence } from "./models/Recurrence";
import { fromStorage } from "./TaskFactory";

// ──────────────────────────────────────────────────────────────
// Persistence Record Shape (JSON-safe)
// ──────────────────────────────────────────────────────────────

/**
 * The persistence shape of a DomainTask.
 *
 * Stored in JSON — no branded types, no Object.freeze,
 * no runtime-derived fields (lifecycleState is re-derived on load).
 */
export interface PersistedTask {
  // Identity
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;

  // Lifecycle (persisted status only — lifecycleState is runtime-derived)
  status: string;
  enabled: boolean;
  doneAt?: string;
  cancelledAt?: string;
  statusSymbol?: string;
  onCompletion?: unknown;

  // Scheduling
  dueAt?: string;
  scheduledAt?: string;
  startAt?: string;
  timezone?: string;
  recurrence?: Recurrence;
  recurrenceText?: string;
  whenDone?: boolean;
  seriesId?: string;
  occurrenceIndex?: number;
  smartRecurrence?: unknown;

  // Dependencies
  dependsOn?: string[];
  dependencyLinks?: unknown[];

  // Organization
  priority?: string;
  tags?: string[];
  category?: string;
  order?: number;

  // SiYuan binding
  blockId?: string;
  rootId?: string;
  workspaceId?: string;
  lastMutationTime?: number;
  path?: string;
  heading?: string;

  // Analytics
  analytics?: unknown;

  // Metadata
  description?: string;
  notificationChannels?: string[];
  escalationPolicy?: unknown;
  snoozeCount?: number;
  maxSnoozes?: number;

  // Lossless
  unknownFields?: string[];
}

// ──────────────────────────────────────────────────────────────
// To Persistence (DomainTask → JSON-safe object)
// ──────────────────────────────────────────────────────────────

/**
 * Serialize a DomainTask into a persistence-safe plain object.
 *
 * - Strips branded types (TaskId → string, ISODateString → string)
 * - Omits runtime-derived field: `lifecycleState` (re-derived on load)
 * - Omits `undefined` fields entirely (clean JSON)
 * - Shallow-copies arrays to break frozen references
 *
 * The resulting object is safe for JSON.stringify().
 */
export function toPersistence(task: DomainTask): PersistedTask {
  const result: PersistedTask = {
    id: task.id as string,
    name: task.name,
    version: task.version as number,
    createdAt: task.createdAt as string,
    updatedAt: task.updatedAt as string,
    status: task.status,
    enabled: task.enabled,
  };

  // ── Lifecycle (optional) ──
  if (task.doneAt !== undefined) result.doneAt = task.doneAt as string;
  if (task.cancelledAt !== undefined) result.cancelledAt = task.cancelledAt as string;
  if (task.statusSymbol !== undefined) result.statusSymbol = task.statusSymbol;
  if (task.onCompletion !== undefined) result.onCompletion = task.onCompletion;

  // ── Scheduling ──
  if (task.dueAt !== undefined) result.dueAt = task.dueAt as string;
  if (task.scheduledAt !== undefined) result.scheduledAt = task.scheduledAt as string;
  if (task.startAt !== undefined) result.startAt = task.startAt as string;
  if (task.timezone !== undefined) result.timezone = task.timezone;
  if (task.recurrence !== undefined) result.recurrence = { ...task.recurrence };
  if (task.recurrenceText !== undefined) result.recurrenceText = task.recurrenceText;
  if (task.whenDone !== undefined) result.whenDone = task.whenDone;
  if (task.seriesId !== undefined) result.seriesId = task.seriesId;
  if (task.occurrenceIndex !== undefined) result.occurrenceIndex = task.occurrenceIndex;
  if (task.smartRecurrence !== undefined) result.smartRecurrence = { ...task.smartRecurrence };

  // ── Dependencies ──
  if (task.dependsOn !== undefined) result.dependsOn = [...task.dependsOn];
  if (task.dependencyLinks !== undefined) {
    result.dependencyLinks = task.dependencyLinks.map((link) => ({ ...link }));
  }

  // ── Organization ──
  if (task.priority !== undefined) result.priority = task.priority;
  if (task.tags !== undefined) result.tags = [...task.tags];
  if (task.category !== undefined) result.category = task.category;
  if (task.order !== undefined) result.order = task.order;

  // ── SiYuan binding ──
  if (task.blockId !== undefined) result.blockId = task.blockId;
  if (task.rootId !== undefined) result.rootId = task.rootId;
  if (task.workspaceId !== undefined) result.workspaceId = task.workspaceId;
  if (task.lastMutationTime !== undefined) result.lastMutationTime = task.lastMutationTime;
  if (task.path !== undefined) result.path = task.path;
  if (task.heading !== undefined) result.heading = task.heading;

  // ── Analytics ──
  if (task.analytics !== undefined) {
    result.analytics = serializeAnalytics(task.analytics);
  }

  // ── Metadata ──
  if (task.description !== undefined) result.description = task.description;
  if (task.notificationChannels !== undefined) {
    result.notificationChannels = [...task.notificationChannels];
  }
  if (task.escalationPolicy !== undefined) {
    result.escalationPolicy = {
      enabled: task.escalationPolicy.enabled,
      levels: task.escalationPolicy.levels.map((l) => ({ ...l })),
    };
  }
  if (task.snoozeCount !== undefined) result.snoozeCount = task.snoozeCount;
  if (task.maxSnoozes !== undefined) result.maxSnoozes = task.maxSnoozes;

  // ── Lossless ──
  if (task.unknownFields !== undefined) result.unknownFields = [...task.unknownFields];

  return result;
}

// ──────────────────────────────────────────────────────────────
// From Persistence (JSON-safe object → DomainTask)
// ──────────────────────────────────────────────────────────────

/**
 * Rehydrate a DomainTask from a persistence record.
 *
 * Delegates to TaskFactory.fromStorage() which handles:
 *   - Version migration (V1/V2 → V3)
 *   - Default assignment
 *   - Object.freeze
 *   - Lifecycle state derivation
 */
export function fromPersistence(record: PersistedTask): DomainTask {
  return fromStorage(record as unknown as Record<string, unknown>);
}

// ──────────────────────────────────────────────────────────────
// Batch Operations
// ──────────────────────────────────────────────────────────────

/**
 * Serialize multiple DomainTasks into persistence records.
 */
export function toPersistenceBatch(tasks: readonly DomainTask[]): PersistedTask[] {
  return tasks.map(toPersistence);
}

/**
 * Rehydrate multiple DomainTasks from persistence records.
 */
export function fromPersistenceBatch(records: readonly PersistedTask[]): DomainTask[] {
  return records.map(fromPersistence);
}

// ──────────────────────────────────────────────────────────────
// DTO Projection (for frontend consumption)
// ──────────────────────────────────────────────────────────────

/**
 * Task DTO — the safe, serializable shape exposed to the frontend.
 *
 * This is NOT a domain object. It's a read-only projection of a DomainTask
 * for display purposes only. The frontend cannot write back to the domain.
 */
export interface TaskDTO {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly lifecycleState: string;
  readonly dueAt?: string;
  readonly scheduledAt?: string;
  readonly priority?: string;
  readonly tags?: readonly string[];
  readonly category?: string;
  readonly isRecurring: boolean;
  readonly isBlocked: boolean;
  readonly isOverdue: boolean;
  readonly completionCount: number;
  readonly missCount: number;
  readonly currentStreak: number;
  readonly healthScore: number;
  readonly blockId?: string;
  readonly path?: string;
  readonly heading?: string;
}

/**
 * Project a DomainTask into a read-only DTO for frontend consumption.
 *
 * The DTO strips all domain internals (recurrence rules, dependency links,
 * escalation policies, analytics internals) and exposes only what the
 * UI needs for rendering.
 */
export function toDTO(task: DomainTask, now: Date = new Date()): TaskDTO {
  const isOverdue = !!task.dueAt &&
    task.status === "todo" &&
    new Date(task.dueAt) < now;

  const healthScore = task.analytics
    ? calculateSimpleHealthScore(task.analytics)
    : 100;

  return {
    id: task.id as string,
    name: task.name,
    status: task.status,
    lifecycleState: task.lifecycleState,
    dueAt: task.dueAt as string | undefined,
    scheduledAt: task.scheduledAt as string | undefined,
    priority: task.priority,
    tags: task.tags ? [...task.tags] : undefined,
    category: task.category,
    isRecurring: !!task.recurrence || !!task.recurrenceText,
    isBlocked: task.lifecycleState === "blocked",
    isOverdue,
    completionCount: task.analytics?.completionCount ?? 0,
    missCount: task.analytics?.missCount ?? 0,
    currentStreak: task.analytics?.currentStreak ?? 0,
    healthScore,
    blockId: task.blockId,
    path: task.path,
    heading: task.heading,
  };
}

// ──────────────────────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────────────────────

/**
 * Serialize analytics to a JSON-safe plain object.
 */
function serializeAnalytics(analytics: TaskAnalyticsSnapshot): Record<string, unknown> {
  return {
    completionCount: analytics.completionCount,
    missCount: analytics.missCount,
    currentStreak: analytics.currentStreak,
    bestStreak: analytics.bestStreak,
    recentCompletions: [...analytics.recentCompletions],
    completionHistory: analytics.completionHistory.map((entry) => ({ ...entry })),
    completionContexts: analytics.completionContexts.map((ctx) => ({ ...ctx })),
    learningMetrics: analytics.learningMetrics ? { ...analytics.learningMetrics } : undefined,
    lastUpdatedAt: analytics.lastUpdatedAt as string,
  };
}

/**
 * Simple health score calculation for DTO projection.
 */
function calculateSimpleHealthScore(analytics: TaskAnalyticsSnapshot): number {
  const total = analytics.completionCount + analytics.missCount;
  if (total === 0) return 100;
  const ratio = analytics.completionCount / total;
  return Math.round(ratio * 100);
}
