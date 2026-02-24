import { confirm as siyuanConfirm, showMessage } from "siyuan";

/**
 * Toast notification utility using SiYuan's native showMessage API.
 * All UI mounts inside SiYuan-provided containers (Phase 4 §4.5 compliant).
 */

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  actionLabel?: string;
  onAction?: () => void;
  showCountdown?: boolean;
}

/**
 * Map our toast types to SiYuan's showMessage type parameter.
 * SiYuan supports "info" and "error"; we map success/warning to "info".
 */
function mapToSiyuanType(type: ToastType): "info" | "error" {
  return type === "error" ? "error" : "info";
}

/**
 * Show a toast notification using SiYuan's native showMessage API.
 * Supports action buttons via HTML content injected into SiYuan's message container.
 */
export function showToast(options: ToastOptions): void {
  const {
    message,
    type = "info",
    duration = 3000,
    actionLabel,
    onAction,
  } = options;

  const siyuanType = mapToSiyuanType(type);

  if (actionLabel && onAction) {
    // Generate a unique ID for the action button
    const actionId = `toast-action-${Date.now()}`;
    const htmlContent = `${escapeHTML(message)} <button id="${actionId}" style="margin-left:8px;padding:2px 8px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer;font-size:13px;">${escapeHTML(actionLabel)}</button>`;
    showMessage(htmlContent, duration, siyuanType);

    // Attach click handler after SiYuan inserts the message
    requestAnimationFrame(() => {
      const btn = document.getElementById(actionId);
      if (btn) {
        btn.addEventListener("click", () => {
          onAction();
          const msgEl = btn.closest(".b3-snackbar");
          if (msgEl) msgEl.remove();
        }, { once: true });
      }
    });
  } else {
    showMessage(message, duration, siyuanType);
  }
}

/**
 * Escape HTML special characters for safe injection into showMessage
 */
function escapeHTML(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Convenience methods
 */
export const toast = {
  success: (message: string, duration?: number) =>
    showToast({ message, type: "success", duration }),
  error: (message: string, duration?: number) =>
    showToast({ message, type: "error", duration }),
  warning: (message: string, duration?: number) =>
    showToast({ message, type: "warning", duration }),
  info: (message: string, duration?: number) =>
    showToast({ message, type: "info", duration }),
};

/**
 * Confirm dialog replacement
 */
export function confirmDialog(message: string, title = "Confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    siyuanConfirm(
      title,
      message,
      () => resolve(true),
      () => resolve(false)
    );
  });
}


