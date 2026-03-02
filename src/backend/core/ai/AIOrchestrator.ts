/**
 * AIOrchestrator — Event-driven hub for the AI Intelligence Layer.
 *
 * Lifecycle:
 *   - Created in onLayoutReady() (NOT onload())
 *   - Subscribes to PluginEventBus task lifecycle events
 *   - Routes events → SmartSuggestionEngine → AISuggestionStore → frontend
 *   - Destroyed in onunload()
 *
 * Event subscriptions (Session 19 — hardened to match ML Runtime Rule):
 *   task:complete   → analyzeTask(task, 'task:complete')
 *   task:overdue    → analyzeTask(task, 'task:overdue')
 *   task:missed     → analyzeTask(task, 'task:missed')
 *
 * REMOVED (ML must NOT analyze after reschedule/skip):
 *   task:skip       — removed Session 19
 *   task:reschedule — removed Session 19
 *
 * Outgoing events:
 *   ai:suggestion   → { taskId, suggestions }
 *
 * Persistence management:
 *   ai:suggestion:applied   → mark applied in store
 *   ai:suggestion:dismissed → mark dismissed in store
 *
 * The orchestrator:
 *   - NEVER scans all tasks
 *   - NEVER polls
 *   - NEVER runs in a constructor
 *   - ONLY reacts to events for the specific changed task
 */

import type { Plugin } from "siyuan";
import type { Task } from "@backend/core/models/Task";
import { SmartSuggestionEngine } from "@backend/core/ai/SmartSuggestionEngine";
import { AISuggestionStore } from "@backend/core/ai/store/AISuggestionStore";
import { pluginEventBus, type PluginEventMap } from "@backend/core/events/PluginEventBus";
import { computeAttentionBreakdown, computeAttentionScore } from "@backend/core/attention/AttentionModel";
import { ATTENTION_THRESHOLD } from "@backend/core/attention/AttentionGateTypes";
import * as logger from "@backend/logging/logger";

/** Function that resolves a task by ID (provided by the plugin) */
export type TaskResolver = (taskId: string) => Task | undefined;

export class AIOrchestrator {
  private engine: SmartSuggestionEngine;
  private store: AISuggestionStore;
  private resolveTask: TaskResolver;
  private cleanups: Array<() => void> = [];
  private destroyed = false;

  constructor(plugin: Plugin, resolveTask: TaskResolver) {
    this.engine = new SmartSuggestionEngine();
    this.store = new AISuggestionStore(plugin);
    this.resolveTask = resolveTask;
    // NOTE: No computation here — subscriptions are deferred to init()
  }

  /**
   * Expose the SmartSuggestionEngine for late-binding into ExecutionPipeline.
   * The pipeline is created in Phase 6 but AIOrchestrator in Phase 7,
   * so this getter enables post-construction injection.
   */
  getEngine(): SmartSuggestionEngine {
    return this.engine;
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Call from onLayoutReady(). Loads persisted state and subscribes to events. */
  async init(): Promise<void> {
    if (this.destroyed) return;

    // Load persisted suggestions
    await this.store.load();
    logger.info("AIOrchestrator: initialized, subscribing to task events");

    // Subscribe to task lifecycle events (ONLY completion-class triggers)
    this.subscribe("task:complete", (data) => {
      const task = data.task ?? this.resolveTask(data.taskId);
      if (task) this.handleTaskEvent(task, "task:complete");
    });

    // REMOVED: task:skip — ML must not analyze after skip (Session 19)
    // REMOVED: task:reschedule — ML must not analyze after reschedule (Session 19)

    this.subscribe("task:overdue", (data) => {
      const task = data.task ?? this.resolveTask(data.taskId);
      if (task) this.handleTaskEvent(task, "task:overdue");
    });

    this.subscribe("task:missed", (data) => {
      const task = data.task ?? this.resolveTask(data.taskId);
      if (task) this.handleTaskEvent(task, "task:missed");
    });

    // Handle suggestion lifecycle events from frontend
    this.subscribe("ai:suggestion:applied", (data) => {
      this.store.markApplied(data.taskId, data.suggestionId).catch((err) =>
        logger.error("AIOrchestrator: failed to mark suggestion applied", err)
      );
    });

    this.subscribe("ai:suggestion:dismissed", (data) => {
      this.store.markDismissed(data.taskId, data.suggestionId).catch((err) =>
        logger.error("AIOrchestrator: failed to mark suggestion dismissed", err)
      );
    });
  }

  /** Call from onunload(). Unsubscribes all events and clears state. */
  destroy(): void {
    this.destroyed = true;
    for (const cleanup of this.cleanups) {
      try { cleanup(); } catch { /* already cleared */ }
    }
    this.cleanups = [];
    logger.info("AIOrchestrator: destroyed");
  }

  // ─── Public Query API (for frontend) ─────────────────────

  /** Get active suggestions for a task (called by AISuggestionsPanel) */
  getSuggestionsForTask(taskId: string) {
    return this.store.getForTask(taskId);
  }

  /** Get the underlying store for direct access if needed */
  getStore(): AISuggestionStore {
    return this.store;
  }

  // ─── Internal ─────────────────────────────────────────────

  /**
   * Core event handler: analyze one task and emit results.
   * This is the ONLY place analysis happens — always for a single task.
   *
   * Attention gating: suggestions are only emitted to the frontend when
   * the task's attention score is above ATTENTION_THRESHOLD. This prevents
   * displaying AI suggestions for abandoned or low-relevance tasks.
   */
  private async handleTaskEvent(task: Task, trigger: string): Promise<void> {
    if (this.destroyed) return;

    try {
      const suggestions = this.engine.analyzeTask(task, trigger);
      if (suggestions.length === 0) return;

      // Persist suggestions regardless of attention gate (for later retrieval)
      await this.store.upsert(task.id, suggestions);

      // Gate frontend emission through attention model
      const breakdown = computeAttentionBreakdown(task);
      const attentionScore = computeAttentionScore(breakdown);

      if (attentionScore < ATTENTION_THRESHOLD) {
        logger.info(
          `AIOrchestrator: ${suggestions.length} suggestion(s) for task ${task.id} suppressed (attention: ${(attentionScore * 100).toFixed(0)}%) [${trigger}]`
        );
        return;
      }

      // Emit attention-filtered suggestion event for frontend
      const activeSuggestions = this.store.getForTask(task.id);
      pluginEventBus.emit("ai:attention:suggestion", {
        taskId: task.id,
        attentionScore,
        suggestions: activeSuggestions,
      });

      // Also emit on legacy channel for backward compatibility
      pluginEventBus.emit("ai:suggestion", {
        taskId: task.id,
        suggestions: activeSuggestions,
      });

      logger.info(
        `AIOrchestrator: ${suggestions.length} suggestion(s) for task ${task.id} [${trigger}]`
      );
    } catch (err) {
      logger.error(`AIOrchestrator: analysis failed for task ${task.id}`, err);
    }
  }

  /** Helper to subscribe and track cleanup */
  private subscribe<K extends keyof PluginEventMap>(
    event: K,
    handler: (data: PluginEventMap[K]) => void
  ): void {
    const unsub = pluginEventBus.on(event, handler);
    this.cleanups.push(unsub);
  }
}
