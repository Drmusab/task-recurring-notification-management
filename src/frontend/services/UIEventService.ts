/**
 * UIEventService — Frontend Event Subscription Facade
 *
 * The ONLY way components should subscribe to backend events.
 * Translates raw PluginEventBus events into typed UI callbacks
 * with DTO payloads — never exposing domain types or bus instances.
 *
 * Components call:
 *   unsub = uiEventService.onTaskRefresh(handler)
 *   unsub = uiEventService.onTaskCompleted(handler)
 *   unsub = uiEventService.onReminderDue(handler)
 *   unsub = uiEventService.onAISuggestion(handler)
 *
 * Components NEVER call:
 *   ❌ pluginEventBus.on(...)
 *   ❌ pluginEventBus.emit(...)
 *   ❌ eventService.on(...)     (backend-only)
 *
 * FORBIDDEN:
 *   ❌ Import Svelte (this is a plain TS class)
 *   ❌ Trigger mutations (delegate to UITaskMutationService)
 *   ❌ Access DOM
 *   ❌ Emit events (read-only subscription layer)
 */

// ── No backend imports — structural typing only ────────────────

import type {
  TaskDTO,
  ReminderDTO,
  SuggestionDTO,
  DependencyDTO,
} from "./DTOs";
import { uiQueryService } from "./UIQueryService";

// ──────────────────────────────────────────────────────────────
// Structural Interfaces (replace backend type imports)
// ──────────────────────────────────────────────────────────────

/** Structural interface for the plugin event bus. */
interface EventBusLike {
  on(event: string, handler: (...args: any[]) => void): () => void;
  emit(event: string, data?: unknown): void;
}

// ──────────────────────────────────────────────────────────────
// Callback Payload Types
// ──────────────────────────────────────────────────────────────

export interface TaskRefreshPayload {
  /** Refreshed task list — components should re-render from this */
  tasks: TaskDTO[];
}

export interface TaskCompletedPayload {
  taskId: string;
  completedAt?: string;
  nextDueAt?: string;
}

export interface TaskRescheduledPayload {
  taskId: string;
  previousDueAt: string;
  newDueAt: string;
  reason: string;
}

export interface TaskSavedPayload {
  task: TaskDTO;
  isNew: boolean;
}

export interface TaskUpdatedPayload {
  taskId: string;
}

export interface ReminderDuePayload {
  taskId: string;
  dueAt: string;
  task?: TaskDTO;
}

export interface AISuggestionPayload {
  taskId: string;
  suggestions: SuggestionDTO[];
}

export interface DependencyResolvedPayload {
  taskId: string;
  resolvedDepId: string;
}

export interface DependencyBlockedPayload {
  taskId: string;
  blockers: string[];
}

export interface EscalationPayload {
  taskId: string;
  level: number;
  reason: string;
  timestamp: string;
}

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface UIEventServiceDeps {
  pluginEventBus: EventBusLike;
}

type Unsub = () => void;

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class UIEventService {
  private eventBus: EventBusLike | null = null;
  private readonly managedUnsubs: Unsub[] = [];

  /**
   * Connect to backend event bus.
   * Called from plugin index.ts after services are initialized.
   */
  connect(deps: UIEventServiceDeps): void {
    this.eventBus = deps.pluginEventBus;
  }

  /**
   * Disconnect: unsubscribe all managed handlers.
   * Called on plugin unload.
   */
  disconnect(): void {
    for (const unsub of this.managedUnsubs) {
      try { unsub(); } catch { /* handler already removed */ }
    }
    this.managedUnsubs.length = 0;
    this.eventBus = null;
  }

  // ── Subscription API (DTO-mapped callbacks) ──────────────────

  /**
   * Subscribe to full task list refresh.
   * Fires on: task:refresh, task:saved, task:complete.
   * Handler receives the current DTO snapshot from UIQueryService.
   */
  onTaskRefresh(handler: (payload: TaskRefreshPayload) => void): Unsub {
    const refreshHandler = () => {
      const tasks = uiQueryService.selectDashboard();
      handler({ tasks });
    };

    const unsubs = [
      this.subscribe("task:refresh", refreshHandler),
      this.subscribe("task:saved", refreshHandler),
      this.subscribe("task:complete", refreshHandler),
    ];

    const combinedUnsub = () => unsubs.forEach((u) => u());
    return combinedUnsub;
  }

  /**
   * Subscribe to task completion events.
   */
  onTaskCompleted(handler: (payload: TaskCompletedPayload) => void): Unsub {
    return this.subscribe("task:runtime:completed", (data) => {
      handler({
        taskId: data.taskId,
        completedAt: data.completedAt,
        nextDueAt: data.nextDueAt,
      });
    });
  }

  /**
   * Subscribe to task rescheduled events.
   */
  onTaskRescheduled(handler: (payload: TaskRescheduledPayload) => void): Unsub {
    return this.subscribe("task:runtime:rescheduled", (data) => {
      handler({
        taskId: data.taskId,
        previousDueAt: data.previousDueAt,
        newDueAt: data.newDueAt,
        reason: data.reason,
      });
    });
  }

  /**
   * Subscribe to task saved (create or update persist).
   */
  onTaskSaved(handler: (payload: TaskSavedPayload) => void): Unsub {
    return this.subscribe("task:saved", (data) => {
      const dto = uiQueryService.selectById(data.task?.id);
      if (dto) {
        handler({ task: dto, isNew: data.isNew });
      }
    });
  }

  /**
   * Subscribe to field-level task update signals.
   */
  onTaskUpdated(handler: (payload: TaskUpdatedPayload) => void): Unsub {
    return this.subscribe("task:updated", (data) => {
      handler({ taskId: data.taskId });
    });
  }

  /**
   * Subscribe to runtime due reminders (post-attention-gate).
   * Fires on: task:attention:due, task:attention:urgent
   */
  onReminderDue(handler: (payload: ReminderDuePayload) => void): Unsub {
    const dueHandler = (data: any) => {
      const task = data.taskId ? uiQueryService.selectById(data.taskId) : undefined;
      handler({
        taskId: data.taskId,
        dueAt: data.dueAt ?? data.task?.dueAt ?? "",
        task,
      });
    };

    const unsubs = [
      this.subscribe("task:attention:due", dueHandler),
      this.subscribe("task:attention:urgent", dueHandler),
    ];
    const combinedUnsub = () => unsubs.forEach((u) => u());
    return combinedUnsub;
  }

  /**
   * Subscribe to AI suggestion events.
   * Maps AISuggestion[] from backend to SuggestionDTO[].
   */
  onAISuggestion(handler: (payload: AISuggestionPayload) => void): Unsub {
    return this.subscribe("ai:suggestion", (data) => {
      const suggestions: SuggestionDTO[] = (data.suggestions || []).map((s: any) => ({
        id: s.id ?? `sug_${Math.random().toString(36).slice(2, 9)}`,
        taskId: data.taskId,
        type: s.type ?? "general",
        reason: s.reason ?? s.description ?? "",
        confidence: s.confidence ?? 0,
        dismissed: false,
        action: {
          type: s.action?.type ?? "none",
          label: s.action?.label ?? s.action?.description ?? "No action",
          parameters: s.action?.parameters ?? {},
        },
      }));
      handler({ taskId: data.taskId, suggestions });
    });
  }

  /**
   * Subscribe to attention-filtered AI suggestions.
   */
  onAttentionSuggestion(handler: (payload: AISuggestionPayload) => void): Unsub {
    return this.subscribe("ai:attention:suggestion", (data: any) => {
      const suggestions: SuggestionDTO[] = (data.suggestions || [data]).map((s: any) => ({
        id: s.id ?? `asug_${Math.random().toString(36).slice(2, 9)}`,
        taskId: data.taskId,
        type: s.type ?? "attention",
        reason: s.reason ?? "",
        confidence: s.confidence ?? s.score ?? 0,
        dismissed: false,
        action: {
          type: s.action?.type ?? "none",
          label: s.action?.label ?? "No action",
          parameters: s.action?.parameters ?? {},
        },
      }));
      handler({ taskId: data.taskId, suggestions });
    });
  }

  /**
   * Subscribe to dependency resolution events.
   */
  onDependencyResolved(handler: (payload: DependencyResolvedPayload) => void): Unsub {
    return this.subscribe("dependency:resolved", (data) => {
      handler({
        taskId: data.taskId,
        resolvedDepId: data.resolvedDepId,
      });
    });
  }

  /**
   * Subscribe to task blocked events.
   */
  onTaskBlocked(handler: (payload: DependencyBlockedPayload) => void): Unsub {
    return this.subscribe("task:blocked", (data) => {
      handler({
        taskId: data.taskId,
        blockers: data.blockers,
      });
    });
  }

  /**
   * Subscribe to task unblocked events.
   */
  onTaskUnblocked(handler: (payload: { taskId: string }) => void): Unsub {
    return this.subscribe("task:unblocked", (data) => {
      handler({ taskId: data.taskId });
    });
  }

  /**
   * Subscribe to escalation events.
   */
  onEscalation(handler: (payload: EscalationPayload) => void): Unsub {
    return this.subscribe("task:escalated", (data) => {
      handler({
        taskId: data.taskId,
        level: data.level,
        reason: data.reason,
        timestamp: data.timestamp,
      });
    });
  }

  /**
   * Subscribe to cache invalidation (for store refresh triggers).
   */
  onCacheInvalidated(handler: (payload: { scope: string; taskId?: string }) => void): Unsub {
    return this.subscribe("cache:task:invalidated", (data) => {
      handler({ scope: data.scope, taskId: data.taskId });
    });
  }

  // ── Raw Event Access (escape hatch for edge cases) ──────────

  /**
   * Low-level subscription to any event. Use sparingly.
   * Prefer purpose-built methods above.
   */
  onRaw(
    event: string,
    handler: (data: any) => void,
  ): Unsub {
    return this.subscribe(event, handler);
  }

  // ── Orchestration Dispatches ─────────────────────────────────
  //
  // These are UI → plugin orchestration signals, NOT domain mutations.
  // They tell the host application to perform navigation / open editors.

  /**
   * Request SiYuan to navigate to a specific block.
   * Plugin orchestrator handles the actual SiYuan API call.
   */
  emitBlockNavigate(blockId: string): void {
    this.eventBus?.emit("block:navigate", { blockId });
  }

  /**
   * Request the plugin to open a task in the editor modal.
   */
  emitTaskEdit(task: TaskDTO): void {
    this.eventBus?.emit("task:edit", { task });
  }

  /**
   * Request a full task list refresh.
   * Used after mutations are applied through UITaskMutationService.
   */
  emitTaskRefresh(): void {
    this.eventBus?.emit("task:refresh", undefined);
  }

  // ── Private Helpers ──────────────────────────────────────────

  private subscribe(
    event: string,
    handler: (data: any) => void,
  ): Unsub {
    if (!this.eventBus) {
      // Return no-op unsub if not connected yet
      return () => {};
    }
    const unsub = this.eventBus.on(event, handler);
    this.managedUnsubs.push(unsub);
    return unsub;
  }
}

// ── Singleton ──────────────────────────────────────────────────

export const uiEventService = new UIEventService();
