/**
 * TaskFactory — The ONLY way to construct/mutate DomainTask objects
 *
 * Every DomainTask enters existence via one of these methods:
 *
 *   TaskFactory.create(partial)          → new task with defaults
 *   TaskFactory.fromBlockAttrs(attrs)    → from SiYuan block attributes
 *   TaskFactory.fromStorage(raw)         → from persistence layer (JSON)
 *   TaskFactory.fromLegacy(legacyTask)   → migrate old Task → DomainTask
 *   TaskFactory.fromRecurrenceInstance() → promote RecurrenceInstance
 *
 * Mutation methods (return NEW frozen DomainTask — never mutate):
 *
 *   TaskFactory.applyTransition(task, action, ctx)
 *   TaskFactory.withAnalytics(task, snapshot)
 *   TaskFactory.withDependencyLinks(task, links)
 *   TaskFactory.patch(task, overrides)
 *
 * FORBIDDEN:
 *   ❌ Import Scheduler, Storage, EventBus, SiYuan API, DOM, Integration, Service
 *   ❌ Direct field assignment: task.status = "done"
 *   ❌ Array mutation: task.dependsOn.push()
 *   ❌ Object.assign(task, ...)
 */

import type {
  DomainTask,
  TaskId,
  ISODateString,
  TaskPriority,
  TaskStatus,
  CompletionAction,
  OnCompletionAction,
  SmartRecurrenceConfig,
  EscalationPolicy,
} from "./DomainTask";
import type { Recurrence } from "./models/Recurrence";
import type { TaskAnalyticsSnapshot } from "./TaskAnalytics";
import type { TaskLifecycleStateValue } from "./TaskLifecycleState";
import type { DependencyLink } from "./DependencyLink";
import type { RecurrenceInstance } from "./RecurrenceInstance";
import type { TaskCompletionContext } from "./TaskCompletionContext";
import type { DomainVersion } from "./DomainVersion";

import { createEmptyAnalytics, recordCompletion, recordMiss } from "./TaskAnalytics";
import { applyTransition as applyLifecycleTransition, deriveLifecycleState } from "./TaskLifecycleState";
import { CURRENT_DOMAIN_VERSION, needsMigration } from "./DomainVersion";

// ──────────────────────────────────────────────────────────────
// ID Generation
// ──────────────────────────────────────────────────────────────

function generateTaskId(): TaskId {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}` as TaskId;
}

// ──────────────────────────────────────────────────────────────
// Freeze Helper
// ──────────────────────────────────────────────────────────────

/**
 * Deep-freeze a DomainTask. All nested objects and arrays become read-only.
 */
function deepFreeze(task: DomainTask): DomainTask {
  // Freeze top level
  Object.freeze(task);

  // Freeze nested arrays
  if (task.dependsOn) Object.freeze(task.dependsOn);
  if (task.dependencyLinks) Object.freeze(task.dependencyLinks);
  if (task.tags) Object.freeze(task.tags);
  if (task.notificationChannels) Object.freeze(task.notificationChannels);
  if (task.unknownFields) Object.freeze(task.unknownFields);
  if (task.analytics) Object.freeze(task.analytics);
  if (task.recurrence) Object.freeze(task.recurrence);
  if (task.smartRecurrence) Object.freeze(task.smartRecurrence);
  if (task.escalationPolicy) {
    Object.freeze(task.escalationPolicy);
    if (task.escalationPolicy.levels) Object.freeze(task.escalationPolicy.levels);
  }

  return task;
}

// ──────────────────────────────────────────────────────────────
// Create (new task from scratch)
// ──────────────────────────────────────────────────────────────

/** Partial input for creating a new DomainTask */
export interface CreateTaskInput {
  name: string;
  dueAt?: string;
  scheduledAt?: string;
  startAt?: string;
  recurrence?: Recurrence;
  recurrenceText?: string;
  whenDone?: boolean;
  priority?: TaskPriority;
  tags?: string[];
  category?: string;
  description?: string;
  blockId?: string;
  rootId?: string;
  workspaceId?: string;
  dependsOn?: string[];
  timezone?: string;
  notificationChannels?: string[];
  onCompletion?: CompletionAction | OnCompletionAction;
  smartRecurrence?: SmartRecurrenceConfig;
  escalationPolicy?: EscalationPolicy;
  maxSnoozes?: number;
  statusSymbol?: string;
  path?: string;
  heading?: string;
  order?: number;
}

/**
 * Create a new DomainTask with sensible defaults.
 *
 * Returns a frozen, immutable object.
 */
export function create(input: CreateTaskInput): DomainTask {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("[TaskFactory] Task name cannot be empty");
  }

  const now = new Date();
  const nowISO = now.toISOString() as ISODateString;
  const id = generateTaskId();
  const dueAt = input.dueAt as ISODateString | undefined;

  const task: DomainTask = {
    // Identity
    id,
    name: input.name.trim(),
    version: CURRENT_DOMAIN_VERSION,
    createdAt: nowISO,
    updatedAt: nowISO,

    // Lifecycle
    status: "todo",
    lifecycleState: deriveLifecycleState("todo", input.dueAt, now),
    enabled: true,
    doneAt: undefined,
    cancelledAt: undefined,
    statusSymbol: input.statusSymbol,
    onCompletion: input.onCompletion,

    // Scheduling
    dueAt,
    scheduledAt: input.scheduledAt as ISODateString | undefined,
    startAt: input.startAt as ISODateString | undefined,
    timezone: input.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrence: input.recurrence,
    recurrenceText: input.recurrenceText,
    whenDone: input.whenDone,
    seriesId: undefined,
    occurrenceIndex: undefined,
    smartRecurrence: input.smartRecurrence,

    // Dependencies
    dependsOn: input.dependsOn ? [...input.dependsOn] : undefined,
    dependencyLinks: undefined,

    // Organization
    priority: input.priority ?? "normal",
    tags: input.tags ? [...input.tags] : undefined,
    category: input.category,
    order: input.order,

    // SiYuan binding
    blockId: input.blockId,
    rootId: input.rootId,
    workspaceId: input.workspaceId,
    lastMutationTime: undefined,
    path: input.path,
    heading: input.heading,

    // Analytics
    analytics: createEmptyAnalytics(),

    // Metadata
    description: input.description,
    notificationChannels: input.notificationChannels ? [...input.notificationChannels] : undefined,
    escalationPolicy: input.escalationPolicy,
    snoozeCount: 0,
    maxSnoozes: input.maxSnoozes ?? 3,

    // Lossless parsing
    unknownFields: undefined,
  };

  return deepFreeze(task);
}

// ──────────────────────────────────────────────────────────────
// From Block Attributes (/api/attr/getBlockAttrs)
// ──────────────────────────────────────────────────────────────

/**
 * Create a DomainTask from SiYuan block attributes.
 *
 * Uses the SiYuan `/api/attr/getBlockAttrs` response format.
 * Custom attributes are prefixed with `custom-`.
 */
export function fromBlockAttrs(
  blockId: string,
  attrs: Record<string, string>,
): DomainTask {
  const name =
    attrs["custom-task-name"] ?? attrs["name"] ?? attrs["title"] ?? "Untitled Task";
  const dueAt = attrs["custom-task-dueAt"] ?? attrs["custom-task-due"];
  const status = (attrs["custom-task-status"] ?? "todo") as TaskStatus;
  const priority = (attrs["custom-task-priority"] ?? "normal") as TaskPriority;
  const tags = attrs["custom-task-tags"]
    ? attrs["custom-task-tags"].split(",").map((t) => t.trim())
    : undefined;
  const dependsOn = attrs["custom-task-dependsOn"]
    ? attrs["custom-task-dependsOn"].split(",").map((d) => d.trim())
    : undefined;

  return create({
    name,
    dueAt,
    priority,
    tags,
    dependsOn,
    blockId,
    rootId: attrs["rootID"] ?? attrs["root_id"],
    workspaceId: attrs["box"],
    path: attrs["hpath"] ?? attrs["path"],
    statusSymbol: attrs["custom-task-statusSymbol"],
    description: attrs["memo"] ?? attrs["custom-task-description"],
  });
}

// ──────────────────────────────────────────────────────────────
// From Storage (persistence layer deserialization)
// ──────────────────────────────────────────────────────────────

/**
 * Rehydrate a DomainTask from a raw storage record.
 *
 * This is the inverse of DomainMapper.toPersistence().
 * Handles version migration if the stored version is older.
 */
export function fromStorage(raw: Record<string, unknown>): DomainTask {
  const version = (typeof raw.version === "number" ? raw.version : 1) as DomainVersion;

  // If old version, delegate to migration
  if (needsMigration(version)) {
    return migrateAndFreeze(raw, version);
  }

  const status = (raw.status as TaskStatus) ?? "todo";
  const dueAt = raw.dueAt as string | undefined;
  const now = new Date();

  const task: DomainTask = {
    id: (raw.id as string as TaskId) ?? generateTaskId(),
    name: (raw.name as string) ?? "",
    version: CURRENT_DOMAIN_VERSION,
    createdAt: (raw.createdAt as string as ISODateString) ?? now.toISOString() as ISODateString,
    updatedAt: (raw.updatedAt as string as ISODateString) ?? now.toISOString() as ISODateString,

    status,
    lifecycleState: (raw.lifecycleState as TaskLifecycleStateValue)
      ?? deriveLifecycleState(status, dueAt, now),
    enabled: raw.enabled !== false,
    doneAt: raw.doneAt as ISODateString | undefined,
    cancelledAt: raw.cancelledAt as ISODateString | undefined,
    statusSymbol: raw.statusSymbol as string | undefined,
    onCompletion: raw.onCompletion as CompletionAction | OnCompletionAction | undefined,

    dueAt: dueAt as ISODateString | undefined,
    scheduledAt: raw.scheduledAt as ISODateString | undefined,
    startAt: raw.startAt as ISODateString | undefined,
    timezone: raw.timezone as string | undefined,
    recurrence: raw.recurrence as Recurrence | undefined,
    recurrenceText: raw.recurrenceText as string | undefined,
    whenDone: raw.whenDone as boolean | undefined,
    seriesId: raw.seriesId as string | undefined,
    occurrenceIndex: raw.occurrenceIndex as number | undefined,
    smartRecurrence: raw.smartRecurrence as SmartRecurrenceConfig | undefined,

    dependsOn: Array.isArray(raw.dependsOn) ? [...raw.dependsOn] : undefined,
    dependencyLinks: Array.isArray(raw.dependencyLinks) ? [...raw.dependencyLinks] : undefined,

    priority: (raw.priority as TaskPriority) ?? "normal",
    tags: Array.isArray(raw.tags) ? [...raw.tags] : undefined,
    category: raw.category as string | undefined,
    order: raw.order as number | undefined,

    blockId: raw.blockId as string | undefined,
    rootId: raw.rootId as string | undefined,
    workspaceId: raw.workspaceId as string | undefined,
    lastMutationTime: raw.lastMutationTime as number | undefined,
    path: raw.path as string | undefined,
    heading: raw.heading as string | undefined,

    analytics: raw.analytics as TaskAnalyticsSnapshot | undefined
      ?? createEmptyAnalytics(),

    description: raw.description as string | undefined,
    notificationChannels: Array.isArray(raw.notificationChannels)
      ? [...raw.notificationChannels]
      : undefined,
    escalationPolicy: raw.escalationPolicy as EscalationPolicy | undefined,
    snoozeCount: (raw.snoozeCount as number) ?? 0,
    maxSnoozes: (raw.maxSnoozes as number) ?? 3,

    unknownFields: Array.isArray(raw.unknownFields) ? [...raw.unknownFields] : undefined,
  };

  return deepFreeze(task);
}

// ──────────────────────────────────────────────────────────────
// From Legacy (migrate old backend Task → DomainTask)
// ──────────────────────────────────────────────────────────────

/**
 * Convert a legacy mutable Task (from @backend/core/models/Task or
 * @domain/models/Task) into an immutable DomainTask.
 *
 * This is the bridge between the old mutable world and the new
 * immutable domain. Used during the migration period.
 */
export function fromLegacy(legacy: Record<string, unknown>): DomainTask {
  const now = new Date();
  const status = (legacy.status as TaskStatus)
    ?? (legacy.enabled === false ? "cancelled" : "todo");
  const dueAt = legacy.dueAt as string | undefined;

  // Build analytics from scattered legacy fields
  const analytics: TaskAnalyticsSnapshot = {
    completionCount: (legacy.completionCount as number) ?? 0,
    missCount: (legacy.missCount as number) ?? 0,
    currentStreak: (legacy.currentStreak as number) ?? 0,
    bestStreak: (legacy.bestStreak as number) ?? 0,
    recentCompletions: Array.isArray(legacy.recentCompletions)
      ? [...legacy.recentCompletions]
      : [],
    completionHistory: Array.isArray(legacy.completionHistory)
      ? [...legacy.completionHistory]
      : [],
    completionContexts: Array.isArray(legacy.completionContexts)
      ? [...legacy.completionContexts]
      : [],
    learningMetrics: legacy.learningMetrics as TaskAnalyticsSnapshot["learningMetrics"],
    lastUpdatedAt: (legacy.updatedAt as string as ISODateString) ?? now.toISOString() as ISODateString,
  };

  const task: DomainTask = {
    id: (legacy.id as string as TaskId) ?? generateTaskId(),
    name: (legacy.name as string) ?? "",
    version: CURRENT_DOMAIN_VERSION,
    createdAt: (legacy.createdAt as string as ISODateString) ?? now.toISOString() as ISODateString,
    updatedAt: (legacy.updatedAt as string as ISODateString) ?? now.toISOString() as ISODateString,

    status,
    lifecycleState: deriveLifecycleState(status, dueAt, now),
    enabled: legacy.enabled !== false,
    doneAt: legacy.doneAt as ISODateString | undefined,
    cancelledAt: legacy.cancelledAt as ISODateString | undefined,
    statusSymbol: legacy.statusSymbol as string | undefined,
    onCompletion: legacy.onCompletion as CompletionAction | OnCompletionAction | undefined,

    dueAt: dueAt as ISODateString | undefined,
    scheduledAt: legacy.scheduledAt as ISODateString | undefined,
    startAt: legacy.startAt as ISODateString | undefined,
    timezone: legacy.timezone as string | undefined,
    recurrence: legacy.recurrence as Recurrence | undefined,
    recurrenceText: legacy.recurrenceText as string | undefined,
    whenDone: legacy.whenDone as boolean | undefined,
    seriesId: legacy.seriesId as string | undefined,
    occurrenceIndex: legacy.occurrenceIndex as number | undefined,
    smartRecurrence: legacy.smartRecurrence as SmartRecurrenceConfig | undefined,

    dependsOn: Array.isArray(legacy.dependsOn) ? [...legacy.dependsOn] : undefined,
    dependencyLinks: undefined,

    priority: (legacy.priority as TaskPriority) ?? "normal",
    tags: Array.isArray(legacy.tags) ? [...legacy.tags] : undefined,
    category: legacy.category as string | undefined,
    order: legacy.order as number | undefined,

    blockId: (legacy.blockId as string) ?? (legacy.linkedBlockId as string) ?? undefined,
    rootId: legacy.rootId as string | undefined,
    workspaceId: legacy.workspaceId as string | undefined,
    lastMutationTime: legacy.lastMutationTime as number | undefined,
    path: legacy.path as string | undefined,
    heading: legacy.heading as string | undefined,

    analytics: Object.freeze(analytics),

    description: legacy.description as string | undefined,
    notificationChannels: Array.isArray(legacy.notificationChannels)
      ? [...legacy.notificationChannels]
      : undefined,
    escalationPolicy: legacy.escalationPolicy as EscalationPolicy | undefined,
    snoozeCount: (legacy.snoozeCount as number) ?? 0,
    maxSnoozes: (legacy.maxSnoozes as number) ?? 3,

    unknownFields: Array.isArray(legacy.unknownFields)
      ? [...legacy.unknownFields]
      : undefined,
  };

  return deepFreeze(task);
}

// ──────────────────────────────────────────────────────────────
// From RecurrenceInstance
// ──────────────────────────────────────────────────────────────

/**
 * Promote a RecurrenceInstance to a full DomainTask.
 *
 * The resulting task is independent — it does NOT share any mutable
 * references with the parent template.
 */
export function fromRecurrenceInstance(instance: RecurrenceInstance): DomainTask {
  const now = new Date();
  const nowISO = now.toISOString() as ISODateString;

  const task: DomainTask = {
    id: instance.instanceId,
    name: instance.name,
    version: CURRENT_DOMAIN_VERSION,
    createdAt: instance.createdAt,
    updatedAt: nowISO,

    status: "todo",
    lifecycleState: deriveLifecycleState("todo", instance.resolvedDueAt, now),
    enabled: true,
    doneAt: undefined,
    cancelledAt: undefined,
    onCompletion: undefined,

    dueAt: instance.resolvedDueAt,
    scheduledAt: undefined,
    startAt: undefined,
    timezone: instance.timezone,
    recurrence: instance.recurrence,
    recurrenceText: instance.recurrenceText,
    whenDone: instance.basedOnCompletion,
    seriesId: instance.seriesId,
    occurrenceIndex: instance.occurrenceIndex,
    smartRecurrence: instance.smartRecurrence,

    // CRITICAL: Do NOT inherit template's dependency links
    // Each instance gets fresh dependency resolution
    dependsOn: undefined,
    dependencyLinks: undefined,

    priority: instance.priority,
    tags: instance.tags ? [...instance.tags] : undefined,
    category: instance.category,
    order: undefined,

    blockId: instance.blockId,
    rootId: instance.rootId,
    workspaceId: instance.workspaceId,
    lastMutationTime: undefined,
    path: undefined,
    heading: undefined,

    analytics: createEmptyAnalytics(),

    description: undefined,
    notificationChannels: instance.notificationChannels
      ? [...instance.notificationChannels]
      : undefined,
    escalationPolicy: instance.escalationPolicy,
    snoozeCount: 0,
    maxSnoozes: 3,

    unknownFields: undefined,
  };

  return deepFreeze(task);
}

// ──────────────────────────────────────────────────────────────
// Mutation Methods (return new frozen DomainTask)
// ──────────────────────────────────────────────────────────────

/**
 * Apply a lifecycle transition to a DomainTask.
 *
 * Delegates to TaskLifecycleState.applyTransition().
 * Returns a NEW frozen DomainTask — the original is NEVER mutated.
 */
export { applyLifecycleTransition as applyTransition };

/**
 * Replace the analytics snapshot on a DomainTask.
 * Returns a NEW frozen DomainTask.
 */
export function withAnalytics(
  task: DomainTask,
  analyticsOrAction: TaskAnalyticsSnapshot | "completion" | "miss",
  context?: TaskCompletionContext,
): DomainTask {
  let newAnalytics: TaskAnalyticsSnapshot;

  if (analyticsOrAction === "completion") {
    newAnalytics = recordCompletion(task.analytics ?? createEmptyAnalytics(), {
      completedAt: context ? new Date(context.completedAt) : undefined,
      scheduledFor: context?.scheduledFor ?? task.dueAt,
      tags: context?.tags ?? task.tags,
      relatedBlocks: context?.relatedBlocks,
    });
  } else if (analyticsOrAction === "miss") {
    newAnalytics = recordMiss(task.analytics ?? createEmptyAnalytics());
  } else {
    newAnalytics = analyticsOrAction;
  }

  return deepFreeze({
    ...task,
    analytics: Object.freeze(newAnalytics),
    updatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Replace the dependency links on a DomainTask.
 * Returns a NEW frozen DomainTask.
 */
export function withDependencyLinks(
  task: DomainTask,
  links: readonly DependencyLink[],
): DomainTask {
  return deepFreeze({
    ...task,
    dependencyLinks: Object.freeze([...links]),
    updatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Patch specific fields on a DomainTask.
 * Returns a NEW frozen DomainTask.
 *
 * Does NOT allow patching: id, version, createdAt (immutable identity).
 * Does NOT allow patching: status, lifecycleState (use applyTransition).
 */
export function patch(
  task: DomainTask,
  overrides: Partial<Omit<DomainTask, "id" | "version" | "createdAt" | "status" | "lifecycleState">>,
): DomainTask {
  return deepFreeze({
    ...task,
    ...overrides,
    // Preserve immutable identity
    id: task.id,
    version: task.version,
    createdAt: task.createdAt,
    // Preserve lifecycle (use applyTransition instead)
    status: task.status,
    lifecycleState: task.lifecycleState,
    updatedAt: new Date().toISOString() as ISODateString,
  });
}

/**
 * Create a duplicate DomainTask with a new ID and reset analytics.
 */
export function duplicate(task: DomainTask, nameOverride?: string): DomainTask {
  return deepFreeze({
    ...task,
    id: generateTaskId(),
    name: nameOverride ?? task.name,
    version: CURRENT_DOMAIN_VERSION,
    createdAt: new Date().toISOString() as ISODateString,
    updatedAt: new Date().toISOString() as ISODateString,
    status: "todo",
    lifecycleState: "idle",
    enabled: true,
    doneAt: undefined,
    cancelledAt: undefined,
    analytics: createEmptyAnalytics(),
    snoozeCount: 0,
  });
}

// ──────────────────────────────────────────────────────────────
// Internal Migration
// ──────────────────────────────────────────────────────────────

/**
 * Migrate a raw storage record from an older version to V3 (current).
 */
function migrateAndFreeze(raw: Record<string, unknown>, version: DomainVersion): DomainTask {
  // V1/V2 → V3: Use fromLegacy which handles all old field locations
  return fromLegacy(raw);
}
