/**
 * AISuggestionStore — Persists AI suggestions via SiYuan plugin storage.
 *
 * Uses `plugin.saveData` / `plugin.loadData` so suggestions survive reload.
 * Max suggestions per task is capped to prevent unbounded growth.
 */

import type { Plugin } from "siyuan";
import type {
  AISuggestion,
  AISuggestionState,
} from "@backend/core/ai/types/SuggestionTypes";
import {
  AI_SUGGESTION_STATE_VERSION,
  createEmptyAISuggestionState,
} from "@backend/core/ai/types/SuggestionTypes";
import * as logger from "@backend/logging/logger";

const STORAGE_KEY = "ai_suggestions";
/** Maximum suggestions retained per task */
const MAX_SUGGESTIONS_PER_TASK = 20;

export class AISuggestionStore {
  private plugin: Plugin;
  /** In-memory cache — loaded once, then written through */
  private state: AISuggestionState | null = null;

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  // ─── Public API ───────────────────────────────────────────

  /** Load suggestion state from SiYuan storage (once) */
  async load(): Promise<AISuggestionState> {
    if (this.state) return this.state;

    try {
      const raw = await this.plugin.loadData(STORAGE_KEY);
      if (raw && typeof raw === "object" && "version" in raw && "suggestions" in raw) {
        const loaded = raw as AISuggestionState;
        if (loaded.version > AI_SUGGESTION_STATE_VERSION) {
          logger.warn(
            `AISuggestionStore: loaded version ${loaded.version} > current ${AI_SUGGESTION_STATE_VERSION}. Reading forward-compatible.`
          );
        }
        this.state = loaded;
        return this.state;
      }
    } catch (err) {
      logger.error("AISuggestionStore: failed to load", err);
    }

    this.state = createEmptyAISuggestionState();
    return this.state;
  }

  /** Get all active (non-dismissed, non-applied) suggestions for a task */
  getForTask(taskId: string): AISuggestion[] {
    if (!this.state) return [];
    return (this.state.suggestions[taskId] ?? []).filter(
      (s) => !s.dismissed && !s.applied
    );
  }

  /** Get ALL suggestions (including dismissed/applied) for a task — for history */
  getAllForTask(taskId: string): AISuggestion[] {
    if (!this.state) return [];
    return this.state.suggestions[taskId] ?? [];
  }

  /**
   * Upsert suggestions for a task (merges with existing, deduplicates by type).
   * Only replaces suggestions of the same type if the new one has higher confidence.
   */
  async upsert(taskId: string, incoming: AISuggestion[]): Promise<void> {
    const state = await this.load();
    const existing = state.suggestions[taskId] ?? [];

    const merged = [...existing];

    for (const newSugg of incoming) {
      const idx = merged.findIndex(
        (s) => s.type === newSugg.type && !s.dismissed && !s.applied
      );
      if (idx >= 0) {
        // Replace only if higher confidence
        const existing_sugg = merged[idx];
        if (existing_sugg && newSugg.confidence >= existing_sugg.confidence) {
          merged[idx] = newSugg;
        }
      } else {
        merged.push(newSugg);
      }
    }

    // Cap per-task suggestions
    state.suggestions[taskId] = merged.slice(-MAX_SUGGESTIONS_PER_TASK);
    state.lastUpdatedAt = new Date().toISOString();

    await this.persist();
  }

  /** Mark a suggestion as applied */
  async markApplied(taskId: string, suggestionId: string): Promise<void> {
    const state = await this.load();
    const list = state.suggestions[taskId];
    if (!list) return;
    const sugg = list.find((s) => s.id === suggestionId);
    if (sugg) {
      sugg.applied = true;
      state.lastUpdatedAt = new Date().toISOString();
      await this.persist();
    }
  }

  /** Mark a suggestion as dismissed */
  async markDismissed(taskId: string, suggestionId: string): Promise<void> {
    const state = await this.load();
    const list = state.suggestions[taskId];
    if (!list) return;
    const sugg = list.find((s) => s.id === suggestionId);
    if (sugg) {
      sugg.dismissed = true;
      state.lastUpdatedAt = new Date().toISOString();
      await this.persist();
    }
  }

  /** Remove all suggestions for a deleted task */
  async removeTask(taskId: string): Promise<void> {
    const state = await this.load();
    if (state.suggestions[taskId]) {
      delete state.suggestions[taskId];
      state.lastUpdatedAt = new Date().toISOString();
      await this.persist();
    }
  }

  /** Clear all persisted AI data */
  async clear(): Promise<void> {
    this.state = createEmptyAISuggestionState();
    await this.persist();
  }

  // ─── Internal ─────────────────────────────────────────────

  private async persist(): Promise<void> {
    if (!this.state) return;
    try {
      await this.plugin.saveData(STORAGE_KEY, this.state);
    } catch (err) {
      logger.error("AISuggestionStore: failed to persist", err);
    }
  }
}
