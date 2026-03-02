/**
 * SiYuanApiAdapter — Canonical SiYuan Kernel API Adapter (§3.3)
 *
 * The Infrastructure layer handles ALL external communication with the
 * SiYuan kernel. It normalizes raw API responses into DTOs and emits
 * runtime events for internal consumption.
 *
 * NO business logic belongs here.
 *
 * ── Architecture Rules ───────────────────────────────────────
 *   ✔ All SiYuan API calls MUST go through this adapter
 *   ✔ Validates response.code === 0 on every call
 *   ✔ Normalizes raw attributes into typed DTOs
 *   ✔ Throws SiYuanApiError on failure
 *   ❌ No domain logic
 *   ❌ No scheduler logic
 *   ❌ No UI rendering
 */

import { fetchSyncPost, type IWebSocketData } from "siyuan";

// ──────────────────────────────────────────────────────────────
// Error Types
// ──────────────────────────────────────────────────────────────

/**
 * Thrown when a SiYuan kernel API call returns a non-zero code
 * or fails at the network/transport layer.
 */
export class SiYuanApiError extends Error {
  readonly code: number;
  readonly endpoint: string;
  readonly kernelMessage: string;
  readonly cause?: unknown;

  constructor(opts: {
    endpoint: string;
    code: number;
    kernelMessage: string;
    cause?: unknown;
  }) {
    super(`SiYuan API error [${opts.endpoint}] code=${opts.code}: ${opts.kernelMessage}`);
    this.name = "SiYuanApiError";
    this.endpoint = opts.endpoint;
    this.code = opts.code;
    this.kernelMessage = opts.kernelMessage;
    this.cause = opts.cause;
  }
}

// ──────────────────────────────────────────────────────────────
// Normalized DTO Types
// ──────────────────────────────────────────────────────────────

/** Normalized block attributes returned from the API. */
export interface BlockAttributes {
  readonly id: string;
  readonly type?: string;
  readonly updated?: string;
  readonly customDue?: string;
  readonly customRecurrence?: string;
  readonly customDependsOn?: string;
  readonly customPriority?: string;
  readonly customStatus?: string;
  readonly customTags?: string;
  readonly customCategory?: string;
  /** All raw attributes (including non-custom ones) */
  readonly raw: Record<string, string>;
}

/** Boot progress response. */
export interface BootProgress {
  readonly progress: number;
  readonly details: string;
}

/** Notification push result. */
export interface NotificationResult {
  readonly id: string;
}

/** Block child entry. */
export interface BlockChild {
  readonly id: string;
  readonly type: string;
  readonly subType?: string;
}

/** Kramdown source result. */
export interface BlockKramdown {
  readonly id: string;
  readonly kramdown: string;
}

// ──────────────────────────────────────────────────────────────
// Adapter Implementation
// ──────────────────────────────────────────────────────────────

/**
 * Canonical adapter for SiYuan kernel API communication.
 *
 * All API calls are validated and normalized. Errors are typed.
 * This is the ONLY module that should call `fetchSyncPost` directly.
 */
export class SiYuanApiAdapter {
  // ──────────────────────────────────────────────────────────
  // Core Request
  // ──────────────────────────────────────────────────────────

  /**
   * Execute a validated request to SiYuan's kernel API.
   *
   * @param endpoint  API path, e.g. "/api/attr/getBlockAttrs"
   * @param payload   Request body (JSON-serializable)
   * @returns         The `data` field from SiYuan's response envelope
   */
  async request<T = unknown>(
    endpoint: string,
    payload: Record<string, unknown> = {},
  ): Promise<T> {
    let response: IWebSocketData;

    try {
      response = await fetchSyncPost(endpoint, payload);
    } catch (err) {
      throw new SiYuanApiError({
        endpoint,
        code: -1,
        kernelMessage: "Network or transport error",
        cause: err,
      });
    }

    if (response == null) {
      throw new SiYuanApiError({
        endpoint,
        code: -1,
        kernelMessage: "Received null/undefined response from kernel",
      });
    }

    if (response.code !== 0) {
      throw new SiYuanApiError({
        endpoint,
        code: response.code,
        kernelMessage: response.msg ?? "Unknown kernel error",
      });
    }

    return response.data as T;
  }

  /**
   * Like `request` but returns `null` instead of throwing on non-zero code.
   */
  async requestSafe<T = unknown>(
    endpoint: string,
    payload: Record<string, unknown> = {},
  ): Promise<T | null> {
    try {
      return await this.request<T>(endpoint, payload);
    } catch (err) {
      if (err instanceof SiYuanApiError) return null;
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────
  // Block Attribute Operations (§11.2)
  // ──────────────────────────────────────────────────────────

  /**
   * Get block attributes and normalize into BlockAttributes DTO.
   */
  async getBlockAttributes(blockId: string): Promise<BlockAttributes> {
    const raw = await this.request<Record<string, string>>(
      "/api/attr/getBlockAttrs",
      { id: blockId },
    );
    return this.normalizeAttributes(blockId, raw);
  }

  /**
   * Set block attributes on a single block.
   */
  async setBlockAttributes(
    blockId: string,
    attrs: Record<string, string>,
  ): Promise<void> {
    await this.request("/api/attr/setBlockAttrs", { id: blockId, attrs });
  }

  // ──────────────────────────────────────────────────────────
  // Block Operations (§11.1)
  // ──────────────────────────────────────────────────────────

  /**
   * Insert a new block.
   */
  async insertBlock(params: {
    dataType: "markdown" | "dom";
    data: string;
    nextID?: string;
    previousID?: string;
    parentID?: string;
  }): Promise<Array<{ doOperations: Array<{ id: string; data: string }> }>> {
    return this.request("/api/block/insertBlock", params);
  }

  /**
   * Update an existing block.
   */
  async updateBlock(params: {
    dataType: "markdown" | "dom";
    data: string;
    id: string;
  }): Promise<unknown> {
    return this.request("/api/block/updateBlock", params);
  }

  /**
   * Delete a block.
   */
  async deleteBlock(id: string): Promise<unknown> {
    return this.request("/api/block/deleteBlock", { id });
  }

  /**
   * Get child blocks of a parent block.
   */
  async getChildBlocks(parentId: string): Promise<BlockChild[]> {
    return this.request<BlockChild[]>("/api/block/getChildBlocks", {
      id: parentId,
    });
  }

  /**
   * Get a block's Kramdown source.
   */
  async getBlockKramdown(blockId: string): Promise<BlockKramdown> {
    return this.request<BlockKramdown>("/api/block/getBlockKramdown", {
      id: blockId,
    });
  }

  // ──────────────────────────────────────────────────────────
  // SQL Query (§11.4)
  // ──────────────────────────────────────────────────────────

  /**
   * Execute a SQL query against SiYuan's block database.
   */
  async querySql<T = unknown[]>(stmt: string): Promise<T> {
    return this.request<T>("/api/query/sql", { stmt });
  }

  /**
   * Flush the SQLite write-ahead log.
   */
  async flushTransaction(): Promise<void> {
    await this.request("/api/sqlite/flushTransaction", {});
  }

  // ──────────────────────────────────────────────────────────
  // Notifications (§11.3)
  // ──────────────────────────────────────────────────────────

  /**
   * Push an informational notification to SiYuan's UI.
   */
  async pushNotification(params: {
    msg: string;
    timeout?: number;
  }): Promise<NotificationResult> {
    return this.request<NotificationResult>("/api/notification/pushMsg", {
      msg: params.msg,
      timeout: params.timeout ?? 7000,
    });
  }

  /**
   * Push an error notification to SiYuan's UI.
   */
  async pushErrorNotification(params: {
    msg: string;
    timeout?: number;
  }): Promise<NotificationResult> {
    return this.request<NotificationResult>("/api/notification/pushErrMsg", {
      msg: params.msg,
      timeout: params.timeout ?? 7000,
    });
  }

  // ──────────────────────────────────────────────────────────
  // System (§11.3)
  // ──────────────────────────────────────────────────────────

  /**
   * Get SiYuan kernel boot progress.
   */
  async getBootProgress(): Promise<BootProgress> {
    return this.request<BootProgress>("/api/system/bootProgress", {});
  }

  /**
   * Get SiYuan system version.
   */
  async getSystemVersion(): Promise<string> {
    return this.request<string>("/api/system/version", {});
  }

  /**
   * Get current system time (ms precision).
   */
  async getCurrentTime(): Promise<number> {
    return this.request<number>("/api/system/currentTime", {});
  }

  // ──────────────────────────────────────────────────────────
  // Document Operations
  // ──────────────────────────────────────────────────────────

  /**
   * Export markdown content for a document block.
   */
  async exportMarkdown(docId: string): Promise<{ hPath: string; content: string }> {
    return this.request<{ hPath: string; content: string }>(
      "/api/export/exportMdContent",
      { id: docId },
    );
  }

  // ──────────────────────────────────────────────────────────
  // Attribute Normalization
  // ──────────────────────────────────────────────────────────

  /**
   * Normalize raw SiYuan block attributes into typed BlockAttributes DTO.
   *
   * Extracts `custom-*` prefixed attributes into named fields.
   */
  private normalizeAttributes(
    blockId: string,
    raw: Record<string, string>,
  ): BlockAttributes {
    return {
      id: raw["id"] ?? blockId,
      type: raw["type"],
      updated: raw["updated"],
      customDue: raw["custom-due"],
      customRecurrence: raw["custom-recurrence"],
      customDependsOn: raw["custom-depends-on"],
      customPriority: raw["custom-priority"],
      customStatus: raw["custom-status"],
      customTags: raw["custom-tags"],
      customCategory: raw["custom-category"],
      raw,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Singleton
// ──────────────────────────────────────────────────────────────

/**
 * Default SiYuanApiAdapter instance.
 * Prefer dependency injection; this exists for convenience.
 */
export const siyuanApi = new SiYuanApiAdapter();
