/**
 * SiYuanApiClient — Canonical HTTP request layer for ALL SiYuan kernel API calls.
 *
 * Every module in the plugin that needs to call SiYuan's REST API MUST
 * go through this client.  It guarantees:
 *
 * 1.  `response.code === 0` validation on every call.
 * 2.  Typed `SiYuanApiError` thrown on non-zero code, network failure, or
 *     mal-formed responses.
 * 3.  Zero import-time side effects (no singletons, no globals).
 * 4.  Named exports only — no default export.
 *
 * Usage:
 * ```ts
 * import { siyuanRequest, SiYuanApiError } from "@backend/core/api/SiYuanApiClient";
 *
 * const data = await siyuanRequest<{ notebooks: any[] }>("/api/notebook/lsNotebooks", {});
 * ```
 */

import { fetchSyncPost, type IWebSocketData } from "siyuan";
import * as logger from "@backend/logging/logger";

// ─── Error Types ────────────────────────────────────────────

/**
 * Thrown when a SiYuan kernel API call returns a non-zero code
 * or fails at the network/transport layer.
 */
export class SiYuanApiError extends Error {
  /** HTTP-style endpoint that was called */
  readonly endpoint: string;
  /** SiYuan response code (non-zero), or -1 for transport errors */
  readonly code: number;
  /** Raw message from the kernel response */
  readonly kernelMessage: string;
  /** Original cause (network error, JSON parse error, etc.) */
  readonly cause?: unknown;

  constructor(opts: {
    endpoint: string;
    code: number;
    kernelMessage: string;
    cause?: unknown;
  }) {
    super(
      `SiYuan API error [${opts.endpoint}] code=${opts.code}: ${opts.kernelMessage}`,
    );
    this.name = "SiYuanApiError";
    this.endpoint = opts.endpoint;
    this.code = opts.code;
    this.kernelMessage = opts.kernelMessage;
    this.cause = opts.cause;
  }
}

// ─── Core Request Function ──────────────────────────────────

/**
 * Execute a validated request to SiYuan's kernel API.
 *
 * - Returns `response.data` (typed as `T`) when `response.code === 0`.
 * - Throws `SiYuanApiError` otherwise.
 *
 * @param endpoint  SiYuan API path, e.g. `"/api/attr/setBlockAttrs"`
 * @param payload   Request body (JSON-serializable)
 * @returns         The `data` field from SiYuan's response envelope
 */
export async function siyuanRequest<T = any>(
  endpoint: string,
  payload: Record<string, unknown>,
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
    const msg = response.msg ?? "Unknown kernel error";
    logger.warn(`[SiYuanApiClient] API error on ${endpoint}`, {
      code: response.code,
      msg,
    });
    throw new SiYuanApiError({
      endpoint,
      code: response.code,
      kernelMessage: msg,
    });
  }

  return response.data as T;
}

// ─── Convenience Helpers ────────────────────────────────────

/**
 * Like `siyuanRequest` but returns `null` instead of throwing on non-zero code.
 * Useful for "best-effort" reads where missing data is acceptable.
 */
export async function siyuanRequestSafe<T = any>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T | null> {
  try {
    return await siyuanRequest<T>(endpoint, payload);
  } catch (err) {
    if (err instanceof SiYuanApiError) {
      logger.debug(`[SiYuanApiClient] Safe request returned null for ${endpoint}`, {
        code: err.code,
      });
      return null;
    }
    throw err; // re-throw unexpected errors
  }
}

// ─── Typed Endpoint Wrappers ────────────────────────────────

/**
 * Set block attributes on a single block.
 * Endpoint: POST /api/attr/setBlockAttrs
 */
export async function setBlockAttrs(
  blockId: string,
  attrs: Record<string, string>,
): Promise<void> {
  await siyuanRequest("/api/attr/setBlockAttrs", { id: blockId, attrs });
}

/**
 * Get block attributes for a single block.
 * Endpoint: POST /api/attr/getBlockAttrs
 */
export async function getBlockAttrs(
  blockId: string,
): Promise<Record<string, string>> {
  return siyuanRequest<Record<string, string>>(
    "/api/attr/getBlockAttrs",
    { id: blockId },
  );
}

/**
 * Execute a SQL query against SiYuan's block database.
 * Endpoint: POST /api/query/sql
 *
 * @param stmt  SQL statement (use parameterized attribute lookups, avoid interpolation)
 */
export async function querySql<T = any[]>(stmt: string): Promise<T> {
  return siyuanRequest<T>("/api/query/sql", { stmt });
}

/**
 * Push an informational notification to SiYuan's UI.
 * Endpoint: POST /api/notification/pushMsg
 *
 * @param msg      Message text (HTML supported)
 * @param timeout  Auto-dismiss in milliseconds (default 7000)
 */
export async function pushMsg(
  msg: string,
  timeout: number = 7000,
): Promise<{ id: string }> {
  return siyuanRequest<{ id: string }>("/api/notification/pushMsg", {
    msg,
    timeout,
  });
}

/**
 * Push an error notification to SiYuan's UI.
 * Endpoint: POST /api/notification/pushErrMsg
 *
 * @param msg      Error message text (HTML supported)
 * @param timeout  Auto-dismiss in milliseconds (default 7000)
 */
export async function pushErrMsg(
  msg: string,
  timeout: number = 7000,
): Promise<{ id: string }> {
  return siyuanRequest<{ id: string }>("/api/notification/pushErrMsg", {
    msg,
    timeout,
  });
}

// ─── Block Endpoint Wrappers ────────────────────────────────

/**
 * Get child blocks of a parent block.
 * Endpoint: POST /api/block/getChildBlocks
 *
 * @param id  Parent block ID. Blocks below a heading are also counted as children.
 * @returns   Array of `{ id, type, subType? }` entries
 */
export async function getChildBlocks(
  id: string,
): Promise<Array<{ id: string; type: string; subType?: string }>> {
  return siyuanRequest<Array<{ id: string; type: string; subType?: string }>>(
    "/api/block/getChildBlocks",
    { id },
  );
}

/**
 * Get a block's Kramdown source.
 * Endpoint: POST /api/block/getBlockKramdown
 *
 * @param id  Block ID
 * @returns   `{ id, kramdown }` object
 */
export async function getBlockKramdown(
  id: string,
): Promise<{ id: string; kramdown: string }> {
  return siyuanRequest<{ id: string; kramdown: string }>(
    "/api/block/getBlockKramdown",
    { id },
  );
}

// ─── System / SQLite Endpoint Wrappers ──────────────────────

/**
 * Get boot progress of the SiYuan kernel.
 * Endpoint: POST /api/system/bootProgress
 *
 * @returns `{ progress, details }` — progress is 0-100
 */
export async function getBootProgress(): Promise<{
  progress: number;
  details: string;
}> {
  return siyuanRequest<{ progress: number; details: string }>(
    "/api/system/bootProgress",
    {},
  );
}

/**
 * Flush the SQLite write-ahead log so that subsequent SQL queries
 * see the latest data.  No parameters.
 * Endpoint: POST /api/sqlite/flushTransaction
 */
export async function flushTransaction(): Promise<void> {
  await siyuanRequest("/api/sqlite/flushTransaction", {});
}
