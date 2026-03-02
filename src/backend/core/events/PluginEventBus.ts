import type { Task } from "@backend/core/models/Task";
import type { AISuggestion } from "@backend/core/ai/types/SuggestionTypes";
import type {
  AttentionDuePayload,
  AttentionSuppressedPayload,
  AttentionSuggestionPayload,
} from "@backend/core/attention/AttentionGateTypes";
import * as logger from "@backend/logging/logger";

export type PluginEventMap = {
  'task:create': { 
    source: string;
    suggestedName?: string;
    linkedBlockId?: string;
    linkedBlockContent?: string;
    suggestedTime?: string | null;
  };
  'task:complete': { taskId: string; task?: Task };
  'task:skip': { taskId: string; task?: Task };
  'task:reschedule': { taskId: string; delayMinutes: number; task?: Task };
  'task:snooze': { taskId: string; minutes: number };
  'task:settings': { action?: string };
  'task:refresh': void;
  'task:updated': { taskId: string };
  'task:saved': { task: Task; isNew: boolean };
  'task:edit': { task?: Task };
  'editor:open': { mode: 'create' | 'edit'; taskId?: string; prefill?: Partial<Task> };
  // Document lifecycle events (from SiYuan eventBus)
  'document:opened': { rootId: string };
  'document:saved': { rootId: string };
  'document:switched': { rootId: string };
  'document:closed': { rootId: string };
  // Dashboard events
  'dashboard:filterToday': Record<string, never>;
  // Scheduler / notification events
  'task:due': { taskId?: string };
  // Task overdue (from Scheduler)
  'task:overdue': { taskId: string; task?: Task };
  // Task missed (missed occurrence detection)
  'task:missed': { taskId: string; task?: Task };
  // Navigation events
  'block:navigate': { blockId: string };
  // Block mutation events (from SiYuanRuntimeBridge → ReactiveBlockLayer)
  'block:created': { blockId: string; rootId: string; content?: string };
  'block:updated': { blockId: string; rootId: string; content?: string };
  'block:deleted': { blockId: string; rootId: string };
  'block:checkbox': { blockId: string; rootId: string; checked: boolean };
  // Workspace lifecycle events (CQRS Phase)
  'workspace:changed': { workspaceId: string };
  'workspace:opened': { workspaceId: string };
  'workspace:closed': Record<string, never>;
  // ─── AI Intelligence Events ─────────────────────────────────
  /** Emitted when the AI engine generates new suggestions for a task */
  'ai:suggestion': { taskId: string; suggestions: AISuggestion[] };
  /** Emitted when a suggestion is applied by the user */
  'ai:suggestion:applied': { taskId: string; suggestionId: string };
  /** Emitted when a suggestion is dismissed by the user */
  'ai:suggestion:dismissed': { taskId: string; suggestionId: string };
  // ─── Attention-Aware Event Filtering ────────────────────────
  /** Emitted when a task passes the attention gate (score ≥ ATTENTION_THRESHOLD) */
  'task:attention:due': AttentionDuePayload;
  /** Emitted for overdue tasks that pass the attention gate */
  'task:attention:urgent': AttentionDuePayload;
  /** Emitted when a task is suppressed or muted by the attention gate */
  'task:attention:suppressed': AttentionSuppressedPayload;
  /** AI suggestion filtered through attention relevance */
  'ai:attention:suggestion': AttentionSuggestionPayload;
  // ─── Cache Layer Events ─────────────────────────────────────
  /** Emitted when a single task's cache entry is refreshed */
  'cache:task:updated': { taskId: string };
  /** Emitted when cache entries are invalidated (full or single scope) */
  'cache:task:invalidated': { scope: 'full' | 'single' | 'due'; taskId?: string };
  /** Emitted when analytics cache is refreshed */
  'cache:analytics:updated': { scope: 'full' | 'task'; taskId?: string };
  /** Emitted when recurrence cache is rebuilt or a single task entry is refreshed */
  'cache:recurrence:updated': { scope: 'full' | 'task'; taskId?: string };
  // ─── Dependency Layer Events ────────────────────────────────
  /** Emitted when a task becomes blocked (all deps not met) */
  'task:blocked': { taskId: string; blockers: string[] };
  /** Emitted when a task becomes unblocked (all deps now met) */
  'task:unblocked': { taskId: string };
  /** Emitted when a dependency edge is resolved (dep completed) */
  'dependency:resolved': { taskId: string; resolvedDepId: string };
  /** Emitted when a circular dependency chain is detected */
  'dependency:cycle:detected': { chain: string[]; rejectedEdge: { from: string; to: string } };
  /** Emitted when a dependency is added successfully */
  'dependency:added': { fromTaskId: string; toTaskId: string };
  /** Emitted when a dependency is removed */
  'dependency:removed': { fromTaskId: string; toTaskId: string };
  // ─── Engine Runtime Events ──────────────────────────────────
  /** Emitted when Scheduler confirms a task is due (post-dependency-guard) */
  'task:runtime:due': { taskId: string; dueAt: string; task?: Task };
  /** Emitted when a task is completed via Scheduler.markTaskDone() */
  'task:runtime:completed': { taskId: string; completedAt: string; nextDueAt?: string };
  /** Emitted when a task is rescheduled (delay / snooze / advance) */
  'task:runtime:rescheduled': { taskId: string; previousDueAt: string; newDueAt: string; reason: string };
  /** Emitted when RecurrenceEngine generates a next occurrence */
  'task:runtime:recurrence': { taskId: string; nextDueAt: string; rrule: string };
  /** Emitted when a task occurrence is skipped */
  'task:runtime:skipped': { taskId: string; skippedDueAt: string; nextDueAt?: string };
  /** Emitted when scheduler tick completes a full check cycle */
  'engine:tick:complete': { processed: number; errors: number; durationMs: number };
  // ─── Escalation Pipeline Events ─────────────────────────────
  /** Emitted when an escalation fires for a missed/overdue task */
  'task:escalated': { taskId: string; level: number; reason: string; timestamp: string };
  /** Emitted when a webhook delivery is retried */
  'task:escalation:retry': { taskId: string; attempt: number; nextRetryAt: string };
  /** Emitted when an escalation is resolved (task completed/rescheduled) */
  'task:escalation:resolved': { taskId: string; resolvedBy: 'completed' | 'rescheduled' | 'deleted' | 'manual' };
  /** Emitted when escalation is blocked (dependency or block validation failed) */
  'task:escalation:blocked': { taskId: string; reason: string; blockers?: string[] };
  // ─── Webhook Pipeline Events ────────────────────────────────
  /** Emitted when a webhook is successfully delivered to a target */
  'task:webhook:fired': { taskId: string; eventType: string; deliveryId: string; target: string };
  /** Emitted when a failed webhook delivery is retried */
  'task:webhook:retry': { taskId: string; deliveryId: string; attempt: number; nextRetryAt: string };
  /** Emitted when a webhook is suppressed by validation gates */
  'task:webhook:suppressed': { taskId: string; reason: string; eventType?: string };
  /** Emitted when pending webhook retries are resolved (task completed/deleted) */
  'task:webhook:resolved': { taskId: string; resolvedBy: string };
  // ─── Query Runtime Events ───────────────────────────────────
  /** Emitted after TaskQueryEngine selects valid tasks (post-pipeline) */
  'query:tasks:selected': { count: number; source: string; durationMs: number };
  /** Emitted after filter pipeline narrows results */
  'query:tasks:filtered': { before: number; after: number; filters: string[] };
  /** Emitted when query cache is invalidated (e.g. task mutation, block update) */
  'query:tasks:invalidated': { scope: 'full' | 'single'; taskId?: string; reason: string };

  // ─── Spec-Required Domain Events (Master Refactor Prompt §7) ─
  /** Emitted when a new task is instantiated via TaskService.createTask() */
  'task:runtime:created': { taskId: string; task?: Task; source?: string };
  /** Emitted when a dependency is added or removed */
  'task:runtime:dependencyChanged': { taskId: string; dependencyId: string; action: 'add' | 'remove' };
  /** Emitted when RecurrenceEngine generates a new recurring instance */
  'task:runtime:recurrenceGenerated': { taskId: string; parentTaskId: string; nextDueAt: string; rrule?: string };
  /** Emitted when a task's due date passes — reminder layer trigger */
  'task:reminder:due': { taskId: string; task?: Task };
  /** Emitted when a task is missed (deadline exceeded without completion) */
  'task:runtime:missed': { taskId: string; task?: Task; missedAt: string };
  /** Emitted when the runtime is fully initialized and ready */
  'runtime:ready': Record<string, never>;
  /** Emitted when a task is deleted via TaskService.deleteTask() */
  'task:runtime:deleted': { taskId: string; task?: Task };
  /** Emitted when plugin storage is reloaded from disk */
  'plugin:storage:reload': Record<string, never>;
  // ─── Execution Pipeline Events ──────────────────────────────
  /** Emitted when ExecutionPipeline starts a tick cycle */
  'pipeline:tick:start': { tickId: string; timestamp: string };
  /** Emitted when ExecutionPipeline completes a tick cycle */
  'pipeline:tick:complete': { tickId: string; processed: number; skipped: number; errors: number; durationMs: number };
  /** Emitted when a task is skipped in the pipeline (blocked, invalid block, etc.) */
  'pipeline:task:skipped': { taskId: string; reason: string; stage: string };
};

type EventHandler<T> = (data: T) => void;

export class PluginEventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic event handler storage
  private handlers: Map<string, Set<EventHandler<unknown>>> = new Map();

  /**
   * Register a handler for a plugin event.
   */
  on<K extends keyof PluginEventMap>(event: K, handler: EventHandler<PluginEventMap[K]>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
    return () => this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  /**
   * Emit a plugin event with payload.
   */
  emit<K extends keyof PluginEventMap>(event: K, data: PluginEventMap[K]): void {
    this.handlers.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (err) {
        logger.error(`PluginEventBus handler error for "${String(event)}"`, err);
      }
    });
  }

  /**
   * Clear all registered handlers.
   */
  clear(): void {
    this.handlers.clear();
  }
}

export const pluginEventBus = new PluginEventBus();
