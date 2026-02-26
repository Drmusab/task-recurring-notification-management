/**
 * MLRuntimeAdapter — AI/ML Analysis Gate
 *
 * Controls when ML pattern analysis is triggered.
 *
 * ALLOWED triggers:
 *   - task:runtime:completed  (user finished the task — valid data point)
 *   - task:runtime:missed     (user missed the deadline — valid data point)
 *
 * FORBIDDEN triggers (explicitly blocked):
 *   - task:runtime:rescheduled (intentional user action, not a pattern)
 *   - task:runtime:postponed   (snooze, not useful for learning)
 *   - task:runtime:skipped     (user chose to skip, not a completion signal)
 *   - scheduler tick           (periodic check, no learning signal)
 *
 * This prevents:
 *   - PatternLearner false urgency spikes
 *   - AI analyzing rescheduled tasks as "struggles"
 *   - Coaching Assistant receiving corrupted signals
 *
 * Integration:
 *   EventService → subscribes to task:runtime:completed and task:runtime:missed
 *   AIOrchestrator → receives filtered events only
 *   PatternLearnerStore → isValidMLTrigger() for double-check
 *
 * FORBIDDEN:
 *   - Analyze tasks on reschedule/postpone/skip
 *   - Bypass trigger validation
 *   - Import frontend / Svelte
 *   - Mutate task model
 */

import type { Task, ReadonlyTask } from "@backend/core/models/Task";
import type { EventService } from "./EventService";
import type { BlockAttributeValidator } from "./BlockAttributeValidator";
import { isValidMLTrigger } from "@backend/core/ml/PatternLearnerStore";
import * as logger from "@backend/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

export interface MLRuntimeAdapterDeps {
  eventService: EventService;
  blockValidator: BlockAttributeValidator;
  /** Resolve a task by ID */
  getTask: (taskId: string) => Task | undefined;
}

/** Callback for ML analysis consumers */
export type MLAnalysisCallback = (task: ReadonlyTask, trigger: MLAnalysisTrigger) => void;

/** Events that are valid ML triggers */
export type MLAnalysisTrigger =
  | "task:runtime:completed"
  | "task:runtime:missed";

/** Events that are EXPLICITLY blocked from ML analysis */
export type MLBlockedEvent =
  | "task:runtime:rescheduled"
  | "task:runtime:postponed"
  | "task:runtime:skipped"
  | "engine:tick:complete";

export interface MLRuntimeAdapterStats {
  totalAnalyzed: number;
  totalBlocked: number;
  totalBlockValidationFailed: number;
  triggerCounts: Record<string, number>;
  blockedEvents: Record<string, number>;
}

// ── Constants ────────────────────────────────────────────────

/** Events that are ALLOWED to trigger ML analysis */
const ALLOWED_TRIGGERS = new Set<string>([
  "task:runtime:completed",
  "task:runtime:missed",
]);

/** Events that are EXPLICITLY blocked (log if attempted) */
const BLOCKED_EVENTS = new Set<string>([
  "task:runtime:rescheduled",
  "task:runtime:postponed",
  "task:runtime:skipped",
  "engine:tick:complete",
]);

// ──────────────────────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────────────────────

export class MLRuntimeAdapter {
  private readonly eventService: EventService;
  private readonly blockValidator: BlockAttributeValidator;
  private readonly getTask: (taskId: string) => Task | undefined;

  private active = false;
  private readonly unsubscribes: Array<() => void> = [];
  private readonly analysisCallbacks: Set<MLAnalysisCallback> = new Set();

  // ── Stats ──
  private totalAnalyzed = 0;
  private totalBlocked = 0;
  private totalBlockValidationFailed = 0;
  private readonly triggerCounts: Map<string, number> = new Map();
  private readonly blockedCounts: Map<string, number> = new Map();

  constructor(deps: MLRuntimeAdapterDeps) {
    this.eventService = deps.eventService;
    this.blockValidator = deps.blockValidator;
    this.getTask = deps.getTask;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Start: subscribe to the allowed runtime events.
   * Only task:runtime:completed and task:runtime:missed are subscribed.
   */
  start(): void {
    if (this.active) return;
    this.active = true;

    // Subscribe to completed events
    this.unsubscribes.push(
      this.eventService.on("task:runtime:completed", (data) => {
        void this.handleRuntimeEvent(data.taskId, "task:runtime:completed");
      }),
    );

    // Subscribe to missed events (via task:missed since runtime:missed isn't in PluginEventMap)
    this.unsubscribes.push(
      this.eventService.on("task:missed", (data) => {
        void this.handleRuntimeEvent(data.taskId, "task:runtime:missed");
      }),
    );

    logger.info("[MLRuntimeAdapter] Started — subscribed to completed + missed events");
  }

  /**
   * Stop: unsubscribe all handlers.
   */
  stop(): void {
    if (!this.active) return;

    for (const unsub of this.unsubscribes) {
      try { unsub(); } catch { /* already removed */ }
    }
    this.unsubscribes.length = 0;
    this.active = false;

    logger.info("[MLRuntimeAdapter] Stopped");
  }

  // ── Public API ───────────────────────────────────────────────

  /**
   * Register a callback for ML analysis.
   * The callback receives the task and trigger event ONLY for valid ML triggers.
   */
  onAnalysis(callback: MLAnalysisCallback): () => void {
    this.analysisCallbacks.add(callback);
    return () => this.analysisCallbacks.delete(callback);
  }

  /**
   * Manual trigger — validates before dispatching.
   * Used when you need to programmatically trigger analysis.
   *
   * @returns true if the trigger was valid and dispatched
   */
  async analyze(taskId: string, trigger: string): Promise<boolean> {
    if (!this.active) {
      logger.warn("[MLRuntimeAdapter] Not active — analyze() blocked");
      return false;
    }

    // Validate trigger
    if (!ALLOWED_TRIGGERS.has(trigger)) {
      this.totalBlocked++;
      this.incrementCounter(this.blockedCounts, trigger);

      if (BLOCKED_EVENTS.has(trigger)) {
        logger.debug("[MLRuntimeAdapter] Blocked ML trigger", {
          taskId,
          trigger,
          reason: "Event is in the explicit block list",
        });
      }
      return false;
    }

    // Double-check with PatternLearnerStore validator
    if (!isValidMLTrigger(trigger)) {
      this.totalBlocked++;
      return false;
    }

    return this.handleRuntimeEvent(taskId, trigger as MLAnalysisTrigger);
  }

  /**
   * Get adapter stats for monitoring.
   */
  getStats(): MLRuntimeAdapterStats {
    return {
      totalAnalyzed: this.totalAnalyzed,
      totalBlocked: this.totalBlocked,
      totalBlockValidationFailed: this.totalBlockValidationFailed,
      triggerCounts: Object.fromEntries(this.triggerCounts),
      blockedEvents: Object.fromEntries(this.blockedCounts),
    };
  }

  // ── Private ──────────────────────────────────────────────────

  /**
   * Handle a validated runtime event.
   * Validates block attributes before dispatching to callbacks.
   */
  private async handleRuntimeEvent(
    taskId: string,
    trigger: MLAnalysisTrigger,
  ): Promise<boolean> {
    const task = this.getTask(taskId);
    if (!task) {
      logger.debug("[MLRuntimeAdapter] Task not found", { taskId, trigger });
      return false;
    }

    // Block attribute validation — ensure task's block isn't deleted/archived
    const blockResult = await this.blockValidator.exists(task);
    if (!blockResult.valid) {
      this.totalBlockValidationFailed++;
      logger.debug("[MLRuntimeAdapter] Block validation failed, skipping analysis", {
        taskId,
        trigger,
        reason: blockResult.reason,
      });
      return false;
    }

    // Dispatch to all registered callbacks
    this.totalAnalyzed++;
    this.incrementCounter(this.triggerCounts, trigger);

    for (const callback of this.analysisCallbacks) {
      try {
        callback(task, trigger);
      } catch (error) {
        logger.error("[MLRuntimeAdapter] Analysis callback failed", {
          taskId,
          trigger,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.debug("[MLRuntimeAdapter] Analysis dispatched", {
      taskId,
      trigger,
      callbackCount: this.analysisCallbacks.size,
    });

    return true;
  }

  private incrementCounter(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) || 0) + 1);
  }
}
