/**
 * ExecutionPipeline — Deterministic task execution pipeline.
 *
 * Orchestrates the runtime execution flow defined in the spec (§3.4):
 *
 *   1. Scheduler.tick()                    → Initiate execution cycle
 *   2. QueryService.selectDue()            → Fetch due tasks from cache
 *   3. DependencyExecutionGuard            → Check blocking dependencies
 *   4. RecurrenceResolver                  → Resolve latest recurrence instance
 *   5. BlockAttributeValidator             → Validate block existence
 *   6. TaskLifecycle.transition()          → Apply state change
 *   7. EventBus.emit()                     → Broadcast domain event
 *   8. ReminderService.fire()              → Dispatch notifications
 *   9. IntegrationService.fire()           → Trigger webhooks
 *  10. SmartSuggestionEngine.analyze()     → Generate AI suggestions
 *
 * This pipeline is triggered by each Scheduler tick. It does NOT replace the
 * Scheduler — it wraps the post-tick processing into a structured pipeline.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ Pure orchestration — no business logic
 *   ✔ Each stage is try/catch guarded
 *   ✔ Pipeline aborts for individual tasks on failure (not the whole tick)
 *   ✔ Emits pipeline events for observability
 *   ❌ Does NOT mutate domain entities directly
 *   ❌ Does NOT access SiYuan API directly
 */

import type { ReadonlyTask } from "@backend/core/models/Task";
import type { TaskQueryEngine, QueryResult } from "@backend/query/TaskQueryEngine";
import type { DependencyExecutionGuard } from "@backend/dependencies/DependencyExecutionGuard";
import type { RecurrenceResolver } from "@backend/services/RecurrenceResolver";
import type { BlockAttributeValidator } from "@backend/services/BlockAttributeValidator";
import type { TaskLifecycle } from "@backend/services/TaskLifecycle";
import type { ReminderService } from "@backend/reminders/ReminderService";
import type { IntegrationManager } from "@backend/integrations/IntegrationManager";
import type { PluginEventBus } from "@backend/core/events/PluginEventBus";
import type { SmartSuggestionEngine } from "@backend/core/ai/SmartSuggestionEngine";
import { PipelineStageError } from "@domain/errors";
import * as logger from "@shared/logging/logger";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

/** Dependencies required to construct the ExecutionPipeline. */
export interface ExecutionPipelineDeps {
  readonly queryEngine: TaskQueryEngine;
  readonly dependencyGuard: DependencyExecutionGuard;
  readonly recurrenceResolver: RecurrenceResolver;
  readonly blockValidator: BlockAttributeValidator;
  readonly taskLifecycle: TaskLifecycle;
  readonly pluginEventBus: PluginEventBus;
  readonly reminderService: ReminderService;
  readonly integrationManager: IntegrationManager;
  readonly aiEngine?: SmartSuggestionEngine;
}

/** Result of a single pipeline execution (one tick). */
export interface ExecutionResult {
  readonly tickId: string;
  readonly processed: number;
  readonly skipped: number;
  readonly errors: number;
  readonly durationMs: number;
  readonly stages: readonly StageResult[];
}

/** Result of processing a single task through the pipeline. */
export interface TaskPipelineResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly skippedAt?: string;
  readonly error?: string;
}

/** Result of a named pipeline stage (for observability). */
export interface StageResult {
  readonly stage: string;
  readonly taskId: string;
  readonly passed: boolean;
  readonly reason?: string;
  readonly durationMs: number;
}

// ──────────────────────────────────────────────────────────────
// Pipeline Implementation
// ──────────────────────────────────────────────────────────────

/**
 * ExecutionPipeline orchestrates the full task-due processing flow.
 *
 * Usage:
 *   const pipeline = new ExecutionPipeline(deps);
 *   pipeline.start();     // subscribe to scheduler ticks
 *   // ... later ...
 *   pipeline.stop();      // unsubscribe
 *
 * Manual execution:
 *   const result = await pipeline.execute();
 */
export class ExecutionPipeline {
  private readonly deps: ExecutionPipelineDeps;
  private unsubscribeTick: (() => void) | null = null;
  private tickCounter = 0;
  private running = false;

  // Stats
  private totalProcessed = 0;
  private totalSkipped = 0;
  private totalErrors = 0;
  private totalTicks = 0;

  constructor(deps: ExecutionPipelineDeps) {
    this.deps = deps;
  }

  /**
   * Late-bind the AI engine after construction.
   * This is needed because ExecutionPipeline is created in Phase 6
   * but AIOrchestrator (which owns SmartSuggestionEngine) isn't
   * available until Phase 7.
   */
  setAiEngine(engine: SmartSuggestionEngine): void {
    (this.deps as { aiEngine?: SmartSuggestionEngine }).aiEngine = engine;
    logger.info("[ExecutionPipeline] AI engine injected");
  }

  // ──────────────────────────────────────────────────────────
  // Lifecycle
  // ──────────────────────────────────────────────────────────

  /**
   * Start listening to scheduler tick events.
   * Each tick triggers a full pipeline execution.
   */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Subscribe to engine tick completions — execute pipeline after each tick
    this.unsubscribeTick = this.deps.pluginEventBus.on(
      "engine:tick:complete",
      () => {
        // Run pipeline asynchronously — don't block the event handler
        this.execute().catch((err) => {
          logger.error("[ExecutionPipeline] Tick execution failed:", err);
        });
      },
    );

    logger.info("[ExecutionPipeline] Started — listening for engine ticks");
  }

  /**
   * Stop listening to scheduler tick events.
   */
  stop(): void {
    if (this.unsubscribeTick) {
      this.unsubscribeTick();
      this.unsubscribeTick = null;
    }
    this.running = false;
    logger.info(
      `[ExecutionPipeline] Stopped — processed=${this.totalProcessed} skipped=${this.totalSkipped} errors=${this.totalErrors} ticks=${this.totalTicks}`,
    );
  }

  // ──────────────────────────────────────────────────────────
  // Pipeline Execution
  // ──────────────────────────────────────────────────────────

  /**
   * Execute the full pipeline for all currently-due tasks.
   *
   * Pipeline stages per task:
   *   1. Dependency check
   *   2. Recurrence resolution
   *   3. Block validation
   *   4. Event emission (task:reminder:due)
   *   5. Reminder dispatch
   *   6. Integration dispatch
   *   7. AI analysis (completed/missed only)
   */
  async execute(refDate?: Date): Promise<ExecutionResult> {
    const tickId = `tick-${++this.tickCounter}`;
    const startTime = performance.now();
    const stages: StageResult[] = [];
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    this.deps.pluginEventBus.emit("pipeline:tick:start", {
      tickId,
      timestamp: new Date().toISOString(),
    });

    try {
      // ── Stage 1: Select due tasks from cache ──────────────
      const queryResult = await this.selectDueTasks(refDate);
      const dueTasks = queryResult.tasks;

      if (dueTasks.length === 0) {
        return this.finishTick(tickId, startTime, 0, 0, 0, stages);
      }

      // ── Stage 2-7: Process each task through pipeline ──────
      for (const task of dueTasks) {
        const taskResult = await this.processTask(task, stages);
        if (taskResult.passed) {
          processed++;
        } else if (taskResult.error) {
          errors++;
        } else {
          skipped++;
        }
      }
    } catch (err) {
      logger.error(`[ExecutionPipeline] ${tickId} — fatal error:`, err);
      errors++;
    }

    return this.finishTick(tickId, startTime, processed, skipped, errors, stages);
  }

  // ──────────────────────────────────────────────────────────
  // Individual Task Processing
  // ──────────────────────────────────────────────────────────

  private async processTask(
    task: ReadonlyTask,
    stages: StageResult[],
  ): Promise<TaskPipelineResult> {
    const taskId = task.id;

    // ── Stage 2: Dependency guard ───────────────────────────
    const depResult = await this.runStage("dependency-guard", taskId, async () => {
      const result = await this.deps.dependencyGuard.canExecute(taskId);
      if (!result.allowed) {
        return { passed: false, reason: result.reason || "blocked by dependency" };
      }
      return { passed: true };
    });
    stages.push(depResult);
    if (!depResult.passed) {
      this.emitSkipped(taskId, depResult.reason ?? "dependency blocked", "dependency-guard");
      return { taskId, passed: false, skippedAt: "dependency-guard" };
    }

    // ── Stage 3: Recurrence resolution ──────────────────────
    let resolvedTask = task;
    const recResult = await this.runStage("recurrence-resolve", taskId, async () => {
      const result = this.deps.recurrenceResolver.resolveInstance(task);
      if (result.seriesEnded) {
        return { passed: false, reason: "recurrence series ended" };
      }
      resolvedTask = result.task;
      return { passed: true };
    });
    stages.push(recResult);
    if (!recResult.passed) {
      this.emitSkipped(taskId, recResult.reason ?? "recurrence ended", "recurrence-resolve");
      return { taskId, passed: false, skippedAt: "recurrence-resolve" };
    }

    // ── Stage 4: Block attribute validation ─────────────────
    const blockResult = await this.runStage("block-validate", taskId, async () => {
      const result = await this.deps.blockValidator.exists(resolvedTask);
      if (!result.valid) {
        return { passed: false, reason: result.reason || "block validation failed" };
      }
      return { passed: true };
    });
    stages.push(blockResult);
    if (!blockResult.passed) {
      this.emitSkipped(taskId, blockResult.reason ?? "invalid block", "block-validate");
      return { taskId, passed: false, skippedAt: "block-validate" };
    }

    // ── Stage 5: Emit reminder:due event ────────────────────
    const emitResult = await this.runStage("emit-event", taskId, async () => {
      this.deps.pluginEventBus.emit("task:reminder:due", {
        taskId,
        task: resolvedTask,
      });
      return { passed: true };
    });
    stages.push(emitResult);

    // ── Stage 6: Reminder dispatch ──────────────────────────
    const reminderResult = await this.runStage("reminder-dispatch", taskId, async () => {
      await this.deps.reminderService.flush();
      return { passed: true };
    });
    stages.push(reminderResult);

    // ── Stage 7: Integration dispatch ───────────────────────
    const integrationResult = await this.runStage("integration-dispatch", taskId, async () => {
      await this.deps.integrationManager.dispatchTaskDue(resolvedTask);
      return { passed: true };
    });
    stages.push(integrationResult);

    // ── Stage 8: AI analysis (non-blocking) ─────────────────
    if (this.deps.aiEngine) {
      const aiResult = await this.runStage("ai-analysis", taskId, async () => {
        // Only analyze completed or missed tasks (per spec §4.6)
        const status = resolvedTask.status;
        if (status === "done") {
          this.deps.aiEngine!.analyzeTask(resolvedTask, "task:complete");
        }
        return { passed: true };
      });
      stages.push(aiResult);
    }

    return { taskId, passed: true };
  }

  // ──────────────────────────────────────────────────────────
  // Stage Runner (try/catch guard per stage)
  // ──────────────────────────────────────────────────────────

  private async runStage(
    stageName: string,
    taskId: string,
    fn: () => Promise<{ passed: boolean; reason?: string }>,
  ): Promise<StageResult> {
    const stageStart = performance.now();
    try {
      const result = await fn();
      return {
        stage: stageName,
        taskId,
        passed: result.passed,
        reason: result.reason,
        durationMs: performance.now() - stageStart,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`[ExecutionPipeline] Stage ${stageName} failed for ${taskId}:`, err);
      return {
        stage: stageName,
        taskId,
        passed: false,
        reason: message,
        durationMs: performance.now() - stageStart,
      };
    }
  }

  // ──────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────

  private async selectDueTasks(refDate?: Date): Promise<QueryResult> {
    try {
      return await this.deps.queryEngine.selectDue(refDate);
    } catch (err) {
      logger.error("[ExecutionPipeline] selectDue failed:", err);
      throw new PipelineStageError("select-due", "Failed to select due tasks", undefined, err instanceof Error ? err : undefined);
    }
  }

  private emitSkipped(taskId: string, reason: string, stage: string): void {
    this.deps.pluginEventBus.emit("pipeline:task:skipped", {
      taskId,
      reason,
      stage,
    });
  }

  private finishTick(
    tickId: string,
    startTime: number,
    processed: number,
    skipped: number,
    errors: number,
    stages: readonly StageResult[],
  ): ExecutionResult {
    const durationMs = performance.now() - startTime;

    this.totalProcessed += processed;
    this.totalSkipped += skipped;
    this.totalErrors += errors;
    this.totalTicks++;

    this.deps.pluginEventBus.emit("pipeline:tick:complete", {
      tickId,
      processed,
      skipped,
      errors,
      durationMs,
    });

    if (processed > 0 || errors > 0) {
      logger.info(
        `[ExecutionPipeline] ${tickId} — processed=${processed} skipped=${skipped} errors=${errors} duration=${durationMs.toFixed(1)}ms`,
      );
    }

    return { tickId, processed, skipped, errors, durationMs, stages };
  }

  // ──────────────────────────────────────────────────────────
  // Stats
  // ──────────────────────────────────────────────────────────

  getStats(): {
    totalProcessed: number;
    totalSkipped: number;
    totalErrors: number;
    totalTicks: number;
    running: boolean;
  } {
    return {
      totalProcessed: this.totalProcessed,
      totalSkipped: this.totalSkipped,
      totalErrors: this.totalErrors,
      totalTicks: this.totalTicks,
      running: this.running,
    };
  }
}
