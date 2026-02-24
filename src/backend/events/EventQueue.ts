// @ts-nocheck
import { fetchSyncPost } from 'siyuan';
import { EventDeliveryRecord } from "@backend/events/types/EventTypes";
import * as logger from "@backend/logging/logger";

/**
 * Persistent event queue using SiYuan's native storage API (Phase 4 §4.6 compliant)
 */
export class EventQueue {
  private queue: EventDeliveryRecord[] = [];
  private storageFilename: string;
  private persistEnabled: boolean;

  constructor(dataDir: string, persistEnabled: boolean = true) {
    this.storageFilename = 'event-queue.json';
    this.persistEnabled = persistEnabled;
  }

  /**
   * Initialize queue from disk
   */
  async init(): Promise<void> {
    if (!this.persistEnabled) {
      return;
    }

    try {
      const resp = await fetchSyncPost('/api/file/getFile', { path: `/data/storage/petal/task-recurring-notification-management/${this.storageFilename}` });
      if (resp && resp.code === 0 && resp.data) {
        const parsed = typeof resp.data === 'string' ? JSON.parse(resp.data) : resp.data;
        if (Array.isArray(parsed)) {
          this.queue = parsed;
        } else {
          this.queue = [];
          logger.warn('Event queue storage corrupted; resetting queue');
        }
        logger.info(`Loaded ${this.queue.length} events from queue`);
      }
    } catch (error) {
      // Queue file doesn't exist yet
      logger.warn('Failed to load event queue; starting fresh', { error });
      this.queue = [];
    }
  }

  /**
   * Add event to queue
   */
  async enqueue(record: EventDeliveryRecord): Promise<void> {
    this.queue.push(record);
    await this.persist();
  }

  /**
   * Get pending events for delivery
   */
  getPending(limit: number = 50): EventDeliveryRecord[] {
    const now = new Date();

    return this.queue
      .filter((record) => {
        if (record.status !== 'pending') return false;
        if (!record.nextRetryAt) return true; // New event, deliver immediately

        const retryAt = new Date(record.nextRetryAt);
        return retryAt <= now;
      })
      .slice(0, limit);
  }

  /**
   * Update event record
   */
  async update(eventId: string, updates: Partial<EventDeliveryRecord>): Promise<void> {
    const index = this.queue.findIndex((r) => r.eventId === eventId);
    if (index !== -1) {
      this.queue[index] = { ...this.queue[index], ...updates };
      await this.persist();
    }
  }

  /**
   * Remove event from queue
   */
  async remove(eventId: string): Promise<void> {
    this.queue = this.queue.filter((r) => r.eventId !== eventId);
    await this.persist();
  }

  /**
   * Get queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    delivered: number;
    failed: number;
    abandoned: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter((r) => r.status === 'pending').length,
      delivered: this.queue.filter((r) => r.status === 'delivered').length,
      failed: this.queue.filter((r) => r.status === 'failed').length,
      abandoned: this.queue.filter((r) => r.status === 'abandoned').length,
    };
  }

  /**
   * Cleanup old events
   */
  async cleanup(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const before = this.queue.length;

    this.queue = this.queue.filter((record) => {
      const createdAt = new Date(record.createdAt);
      return createdAt > cutoffDate || record.status === 'pending';
    });

    const removed = before - this.queue.length;

    if (removed > 0) {
      await this.persist();
    }

    return removed;
  }

  /**
   * Persist queue to SiYuan storage (Phase 4 §4.6 compliant)
   */
  private async persist(): Promise<void> {
    if (!this.persistEnabled) {
      return;
    }

    try {
      const content = JSON.stringify(this.queue, null, 2);
      const file = new Blob([content], { type: 'application/json' });
      const formData = new FormData();
      formData.append('path', `/data/storage/petal/task-recurring-notification-management/${this.storageFilename}`);
      formData.append('file', file);
      await fetch('/api/file/putFile', { method: 'POST', body: formData });
    } catch (error) {
      logger.error('Failed to persist event queue', { error });
    }
  }
}
