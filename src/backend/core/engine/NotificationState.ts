/**
 * Persistent notification state to prevent duplicate notifications across restarts
 */

import type { Plugin } from "siyuan";
import * as logger from "@shared/utils/misc/logger";

interface NotificationRecord {
  taskKey: string;
  notifiedAt: string;
  type: "due" | "missed";
}

interface EscalationRecord {
  taskId: string;
  level: number;
  lastEscalatedAt: string;
}

interface NotificationStateData {
  notifications: NotificationRecord[];
  escalations: EscalationRecord[];
  lastCleanup: string;
}

const CLEANUP_THRESHOLD_DAYS = 7;
const MAX_NOTIFICATION_RECORDS = 2000;

export class NotificationState {
  private plugin: Plugin;
  private storageKey: string;
  private notifications: Map<string, NotificationRecord> = new Map();
  private escalations: Map<string, EscalationRecord> = new Map();
  private lastCleanup: Date = new Date();
  private isDirty: boolean = false;

  constructor(plugin: Plugin, storageKey: string) {
    this.plugin = plugin;
    this.storageKey = storageKey;
  }

  /**
   * Load notification state from storage
   */
  async load(): Promise<void> {
    try {
      const data = await this.plugin.loadData(this.storageKey);
      if (data) {
        const state = data as NotificationStateData;
        
        // Load notifications
        if (Array.isArray(state.notifications)) {
          for (const record of state.notifications) {
            this.notifications.set(record.taskKey, record);
          }
        }

        // Load escalations
        if (Array.isArray(state.escalations)) {
          for (const record of state.escalations) {
            this.escalations.set(record.taskId, record);
          }
        }

        // Load last cleanup time
        if (state.lastCleanup) {
          this.lastCleanup = new Date(state.lastCleanup);
        }

        logger.info(`Loaded notification state: ${this.notifications.size} notifications, ${this.escalations.size} escalations`);
        
        // Cleanup old entries
        this.cleanupOldEntries();
      }
    } catch (err) {
      logger.error("Failed to load notification state", err);
      this.notifications.clear();
      this.escalations.clear();
    }
  }

  /**
   * Save notification state to storage
   */
  async save(): Promise<void> {
    if (!this.isDirty) {
      return;
    }

    try {
      const state: NotificationStateData = {
        notifications: Array.from(this.notifications.values()),
        escalations: Array.from(this.escalations.values()),
        lastCleanup: this.lastCleanup.toISOString(),
      };

      await this.plugin.saveData(this.storageKey, state);
      this.isDirty = false;
      logger.debug("Saved notification state");
    } catch (err) {
      logger.error("Failed to save notification state", err);
    }
  }

  /**
   * Force save even if not dirty
   */
  async forceSave(): Promise<void> {
    this.isDirty = true;
    await this.save();
  }

  /**
   * Check if a task has been notified for this occurrence
   */
  hasNotified(taskKey: string): boolean {
    const record = this.notifications.get(taskKey);
    return record !== undefined && record.type === "due";
  }

  /**
   * Mark a task as notified
   */
  markNotified(taskKey: string): void {
    this.notifications.set(taskKey, {
      taskKey,
      notifiedAt: new Date().toISOString(),
      type: "due",
    });
    this.isDirty = true;
    
    // Limit size
    if (this.notifications.size > MAX_NOTIFICATION_RECORDS) {
      const toDelete = Array.from(this.notifications.keys()).slice(0, 100);
      toDelete.forEach((key) => this.notifications.delete(key));
    }
  }

  /**
   * Check if a task has been marked as missed for this occurrence
   */
  hasMissed(taskKey: string): boolean {
    const record = this.notifications.get(taskKey);
    return record !== undefined && record.type === "missed";
  }

  /**
   * Mark a task as missed
   */
  markMissed(taskKey: string): void {
    this.notifications.set(taskKey, {
      taskKey,
      notifiedAt: new Date().toISOString(),
      type: "missed",
    });
    this.isDirty = true;
  }

  /**
   * Get current escalation level for a task
   */
  getEscalationLevel(taskId: string): number {
    const record = this.escalations.get(taskId);
    return record?.level || 0;
  }

  /**
   * Increment escalation level for a task
   */
  incrementEscalation(taskId: string): number {
    const current = this.getEscalationLevel(taskId);
    const newLevel = current + 1;
    
    this.escalations.set(taskId, {
      taskId,
      level: newLevel,
      lastEscalatedAt: new Date().toISOString(),
    });
    this.isDirty = true;
    
    return newLevel;
  }

  /**
   * Reset escalation level for a task
   */
  resetEscalation(taskId: string): void {
    this.escalations.delete(taskId);
    this.isDirty = true;
  }

  /**
   * Generate a unique task key for deduplication
   */
  generateTaskKey(taskId: string, dueAt: string): string {
    // Use date and hour for deduplication (ignores minutes/seconds)
    // Format: YYYY-MM-DDTHH (13 characters from ISO string)
    const dueDate = new Date(dueAt);
    const key = `${taskId}:${dueDate.toISOString().slice(0, 13)}`;
    return key;
  }

  /**
   * Cleanup old notification entries
   */
  private cleanupOldEntries(): void {
    const now = new Date();
    const daysSinceCleanup = (now.getTime() - this.lastCleanup.getTime()) / (1000 * 60 * 60 * 24);
    
    // Only cleanup once per day
    if (daysSinceCleanup < 1) {
      return;
    }

    const thresholdDate = new Date(now.getTime() - CLEANUP_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    
    let cleaned = 0;
    for (const [key, record] of this.notifications.entries()) {
      const notifiedAt = new Date(record.notifiedAt);
      if (notifiedAt < thresholdDate) {
        this.notifications.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old notification records`);
      this.isDirty = true;
    }

    this.lastCleanup = now;
  }
}
