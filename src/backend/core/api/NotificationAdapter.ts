/**
 * NotificationAdapter — Centralized notification dispatch for the plugin.
 *
 * Wraps SiYuan's notification APIs behind a service-friendly interface.
 * Backend services call this adapter instead of importing `showMessage`
 * directly or constructing raw `/api/notification/*` requests.
 *
 * Two delivery channels:
 *  1. `showMessage()` — SiYuan SDK convenience (works inside the plugin process).
 *  2. `/api/notification/pushMsg` + `/api/notification/pushErrMsg` — kernel REST
 *     (works from any context, including web workers or external calls).
 *
 * **Lifecycle rules:**
 *  - No constructor API calls.
 *  - No import-time side effects.
 *  - Named exports only.
 *  - Used exclusively by the service layer; UI components continue using
 *    `showMessage` from `"siyuan"` directly for simple toasts.
 */

import { showMessage } from "siyuan";
import {
  pushMsg as kernelPushMsg,
  pushErrMsg as kernelPushErrMsg,
} from "@backend/core/api/SiYuanApiClient";
import * as logger from "@backend/logging/logger";

// ─── Types ──────────────────────────────────────────────────

export type NotificationLevel = "info" | "warning" | "error";

export interface NotifyOptions {
  /** Message text (plain text or HTML) */
  message: string;
  /** Severity level — maps to visual treatment */
  level?: NotificationLevel;
  /** Auto-dismiss in milliseconds (default 7000) */
  timeout?: number;
  /** If true, prefer the kernel REST API; otherwise use SDK `showMessage` */
  useKernelApi?: boolean;
}

// ─── Notification Adapter ───────────────────────────────────

/**
 * Send a notification to the user via SiYuan's UI layer.
 *
 * Default behaviour: uses `showMessage()` (SDK, synchronous, no network).
 * When `useKernelApi` is true, calls the REST endpoint instead (async).
 */
export async function notify(opts: NotifyOptions): Promise<void> {
  const {
    message,
    level = "info",
    timeout = 7000,
    useKernelApi = false,
  } = opts;

  if (useKernelApi) {
    try {
      if (level === "error") {
        await kernelPushErrMsg(message, timeout);
      } else {
        await kernelPushMsg(message, timeout);
      }
    } catch (err) {
      // Fallback to SDK if kernel call fails
      logger.warn("[NotificationAdapter] Kernel API failed, falling back to SDK", { err });
      showMessage(message, timeout, level === "error" ? "error" : "info");
    }
    return;
  }

  // SDK path — synchronous, always works inside the plugin process
  showMessage(message, timeout, level === "error" ? "error" : "info");
}

/**
 * Convenience: push an informational notification.
 */
export async function notifyInfo(
  message: string,
  timeout: number = 7000,
): Promise<void> {
  await notify({ message, level: "info", timeout });
}

/**
 * Convenience: push a warning notification.
 */
export async function notifyWarn(
  message: string,
  timeout: number = 7000,
): Promise<void> {
  await notify({ message, level: "warning", timeout });
}

/**
 * Convenience: push an error notification.
 */
export async function notifyError(
  message: string,
  timeout: number = 7000,
): Promise<void> {
  await notify({ message, level: "error", timeout });
}
