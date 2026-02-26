/**
 * UrgencyDecayTracker — Tracks per-task ignore counts and decays urgency weight.
 *
 * When a recurring task's `task:due` event is emitted but the user does NOT
 * interact (no completion, no snooze, no dismiss within a window), the tracker
 * records an "ignore" and reduces the urgency multiplier for that task.
 *
 * Lifecycle:
 *   - Created in onLayoutReady() alongside AttentionGateFilter
 *   - Persisted to plugin storage under key "attention-urgency-decay"
 *   - Destroyed in onunload()
 *
 * This prevents the "daily spam loop" for recurring tasks the user consistently ignores.
 *
 * Reset rules:
 *   - On task:complete → reset decay to 1.0 (user engaged)
 *   - On task:snooze  → partial reset (user acknowledged)
 */

import type { Plugin } from "siyuan";
import type { UrgencyDecayEntry, UrgencyDecayMap } from "./AttentionGateTypes";
import {
  URGENCY_DECAY_FACTOR,
  URGENCY_DECAY_FLOOR,
} from "./AttentionGateTypes";
import * as logger from "@backend/logging/logger";

const STORAGE_KEY = "attention-urgency-decay";

export class UrgencyDecayTracker {
  private decayMap: UrgencyDecayMap = {};
  private plugin: Plugin;
  private dirty = false;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  // ─── Lifecycle ────────────────────────────────────────────

  /** Load persisted decay state from plugin storage. */
  async load(): Promise<void> {
    try {
      const raw = await this.plugin.loadData(STORAGE_KEY);
      if (raw && typeof raw === "object") {
        this.decayMap = raw as UrgencyDecayMap;
        logger.info(`[UrgencyDecayTracker] Loaded decay state for ${Object.keys(this.decayMap).length} tasks`);
      }
    } catch (err) {
      logger.warn("[UrgencyDecayTracker] Failed to load decay state, starting fresh", { err });
      this.decayMap = {};
    }
  }

  /** Persist decay state to plugin storage. Only writes if dirty. */
  async save(): Promise<void> {
    if (!this.dirty) return;
    try {
      await this.plugin.saveData(STORAGE_KEY, this.decayMap);
      this.dirty = false;
    } catch (err) {
      logger.error("[UrgencyDecayTracker] Failed to save decay state", err);
    }
  }

  // ─── Query ────────────────────────────────────────────────

  /** Get the decay entry for a task (undefined if no decay recorded). */
  getDecayEntry(taskId: string): UrgencyDecayEntry | undefined {
    return this.decayMap[taskId];
  }

  /** Get the current urgency multiplier for a task (1.0 if no decay). */
  getMultiplier(taskId: string): number {
    return this.decayMap[taskId]?.currentMultiplier ?? 1.0;
  }

  // ─── Mutations ────────────────────────────────────────────

  /**
   * Record an ignore event: the task fired a due event but the user
   * did not interact within the acknowledgment window.
   *
   * Reduces the urgency multiplier by URGENCY_DECAY_FACTOR, floored at URGENCY_DECAY_FLOOR.
   */
  recordIgnore(taskId: string, now: number = Date.now()): void {
    const existing = this.decayMap[taskId];
    const ignoreCount = (existing?.ignoreCount ?? 0) + 1;
    const previous = existing?.currentMultiplier ?? 1.0;
    const decayed = Math.max(URGENCY_DECAY_FLOOR, previous * URGENCY_DECAY_FACTOR);

    this.decayMap[taskId] = {
      ignoreCount,
      currentMultiplier: decayed,
      lastIgnoredAt: now,
    };
    this.dirty = true;

    logger.info(`[UrgencyDecayTracker] Task ${taskId} ignored (count: ${ignoreCount}, multiplier: ${previous.toFixed(2)} → ${decayed.toFixed(2)})`);
  }

  /**
   * Reset decay on task completion — user engaged, restore full urgency.
   */
  resetOnCompletion(taskId: string): void {
    if (this.decayMap[taskId]) {
      delete this.decayMap[taskId];
      this.dirty = true;
      logger.info(`[UrgencyDecayTracker] Task ${taskId} decay reset (completed)`);
    }
  }

  /**
   * Partial reset on snooze — user acknowledged but didn't complete.
   * Restore multiplier halfway back to 1.0.
   */
  resetOnSnooze(taskId: string): void {
    const entry = this.decayMap[taskId];
    if (!entry) return;

    // Halfway restore: (current + 1.0) / 2
    entry.currentMultiplier = Math.min(1.0, (entry.currentMultiplier + 1.0) / 2);
    this.dirty = true;
    logger.info(`[UrgencyDecayTracker] Task ${taskId} decay partially reset (snoozed → ${entry.currentMultiplier.toFixed(2)})`);
  }

  /**
   * Remove a task from tracking (e.g., on task deletion).
   */
  remove(taskId: string): void {
    if (this.decayMap[taskId]) {
      delete this.decayMap[taskId];
      this.dirty = true;
    }
  }

  /**
   * Clear all decay state (for tests or hard reset).
   */
  clear(): void {
    this.decayMap = {};
    this.dirty = true;
  }
}
