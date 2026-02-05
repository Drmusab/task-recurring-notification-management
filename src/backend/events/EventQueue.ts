import * as fs from 'fs/promises';
import * as path from 'path';
import { EventDeliveryRecord } from "@backend/events/types/EventTypes";
import * as logger from "@backend/utils/logger";

/**
 * Persistent event queue
 */
export class EventQueue {
  private queue: EventDeliveryRecord[] = [];
  private persistPath: string;
  private persistEnabled: boolean;

  constructor(dataDir: string, persistEnabled: boolean = true) {
    this.persistPath = path.join(dataDir, 'event-queue.json');
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
      const data = await fs.readFile(this.persistPath, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.queue = parsed;
      } else {
        this.queue = [];
        logger.warn('Event queue storage corrupted; resetting queue', {
          persistPath: this.persistPath,
        });
      }
      logger.info(`Loaded ${this.queue.length} events from queue`);
    } catch (error) {
      // Queue file doesn't exist yet
      const err = error as NodeJS.ErrnoException;
      if (err?.code !== 'ENOENT') {
        logger.warn('Failed to load event queue; starting fresh', {
          persistPath: this.persistPath,
          error,
        });
      }
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
   * Persist queue to disk
   */
  private async persist(): Promise<void> {
    if (!this.persistEnabled) {
      return;
    }

    try {
      await fs.writeFile(this.persistPath, JSON.stringify(this.queue, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to persist event queue', {
        persistPath: this.persistPath,
        error,
      });
    }
  }
}
