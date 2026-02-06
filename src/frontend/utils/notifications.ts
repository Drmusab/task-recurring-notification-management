// @ts-nocheck
import { confirm as siyuanConfirm } from "siyuan";

/**
 * Simple toast notification utility
 * Can be enhanced with more sophisticated UI in the future
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
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  const {
    message,
    type = "info",
    duration = 3000,
    actionLabel,
    onAction,
    showCountdown = false,
  } = options;

  // Create toast element
  const toast = document.createElement("div");
  toast.className = `recurring-tasks-toast recurring-tasks-toast--${type}`;
  const messageEl = document.createElement("span");
  messageEl.textContent = message;
  toast.appendChild(messageEl);

  let countdownInterval: number | null = null;

  if (actionLabel && onAction) {
    const actionButton = document.createElement("button");
    actionButton.type = "button";
    let remainingSeconds = Math.max(1, Math.ceil(duration / 1000));
    actionButton.textContent = showCountdown
      ? `${actionLabel} (${remainingSeconds}s)`
      : actionLabel;
    actionButton.className = "recurring-tasks-toast__action";
    actionButton.addEventListener("click", () => {
      onAction();
      if (countdownInterval !== null) {
        globalThis.clearInterval(countdownInterval);
      }
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    });
    toast.appendChild(actionButton);

    if (showCountdown && duration > 0) {
      countdownInterval = globalThis.setInterval(() => {
        remainingSeconds = Math.max(0, remainingSeconds - 1);
        actionButton.textContent = `${actionLabel} (${remainingSeconds}s)`;
        if (remainingSeconds <= 0 && countdownInterval !== null) {
          globalThis.clearInterval(countdownInterval);
          countdownInterval = null;
        }
      }, 1000);
    }
  }

  // Add styles
  Object.assign(toast.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "12px 20px",
    borderRadius: "6px",
    backgroundColor: getBackgroundColor(type),
    color: "white",
    fontSize: "14px",
    fontWeight: "500",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    zIndex: "10000",
    maxWidth: "420px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    animation: "slideInRight 0.3s ease-out",
  });

  // Add to document
  document.body.appendChild(toast);

  const dismissToast = () => {
    if (countdownInterval !== null) {
      globalThis.clearInterval(countdownInterval);
    }
    toast.style.animation = "slideOutRight 0.3s ease-out";
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  };

  if (duration > 0) {
    setTimeout(() => {
      dismissToast();
    }, duration);
  }
}

/**
 * Get background color for toast type
 */
function getBackgroundColor(type: ToastType): string {
  switch (type) {
    case "success":
      return "#4caf50";
    case "error":
      return "#f44336";
    case "warning":
      return "#ff9800";
    case "info":
    default:
      return "#2196f3";
  }
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

// Add CSS animations if not already present
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOutRight {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .recurring-tasks-toast__action {
      background: rgba(255, 255, 255, 0.2);
      border: none;
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease;
      white-space: nowrap;
    }

    .recurring-tasks-toast__action:hover {
      background: rgba(255, 255, 255, 0.3);
    }
  `;
  document.head.appendChild(style);
}
