<script lang="ts">
  /**
   * Enhanced Error Message Component
   * 
   * Provides consistent error display with:
   * - Actionable error messages
   * - Helpful hints
   * - Retry functionality
   * - Accessibility support
   * 
   * @module ErrorMessage
   */

  import { generateAriaId } from "../../utils/accessibility";

  export let error: string | Error;
  export let title: string = "Something went wrong";
  export let hint: string | null = null;
  export let onRetry: (() => void) | null = null;
  export let onDismiss: (() => void) | null = null;
  export let severity: "error" | "warning" | "info" = "error";

  $: errorMessage = error instanceof Error ? error.message : error;
  $: autoHint = hint ?? generateHint(errorMessage);

  // ARIA IDs for relationships
  const errorTextId = generateAriaId("error-text");
  const errorHintId = generateAriaId("error-hint");

  function generateHint(msg: string): string {
    if (msg.toLowerCase().includes("syntax")) {
      return "Check your query syntax. Use 'where', 'and', 'or' to build conditions.";
    }
    if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
      return "Check your network connection and try again.";
    }
    if (msg.toLowerCase().includes("permission")) {
      return "Check that you have the necessary permissions.";
    }
    if (msg.toLowerCase().includes("not found")) {
      return "The requested resource could not be found.";
    }
    return "Please try again or contact support if the issue persists.";
  }

  const icons = {
    error: "⚠️",
    warning: "⚡",
    info: "ℹ️"
  };

  const ariaRoles = {
    error: "alert",
    warning: "status",
    info: "status"
  };

  // Build aria-describedby
  $: describedby = [errorTextId, autoHint ? errorHintId : null].filter(Boolean).join(" ");
</script>

<div 
  class="rtm-error-message rtm-error-message--{severity}"
  role={ariaRoles[severity]}
  aria-live="assertive"
  aria-describedby={describedby}
>
  <div class="rtm-error-message__header">
    <div class="rtm-error-message__icon" aria-hidden="true">
      {icons[severity]}
    </div>
    <div class="rtm-error-message__title">
      {title}
    </div>
    {#if onDismiss}
      <button
        class="rtm-error-message__dismiss"
        on:click={onDismiss}
        aria-label="Dismiss {severity} message"
        type="button"
      >
        ✕
      </button>
    {/if}
  </div>

  <div class="rtm-error-message__content">
    <p class="rtm-error-message__text" id={errorTextId}>{errorMessage}</p>
    {#if autoHint}
      <p class="rtm-error-message__hint" id={errorHintId}>💡 {autoHint}</p>
    {/if}
  </div>

  {#if onRetry}
    <div class="rtm-error-message__actions">
      <button
        class="rtm-btn rtm-btn--primary"
        on:click={onRetry}
        type="button"
        aria-label="Retry the failed action"
      >
        🔄 Try Again
      </button>
    </div>
  {/if}
</div>

<style>
  .rtm-error-message {
    border-radius: 6px;
    padding: 16px;
    margin: 12px 0;
    background: var(--b3-theme-error-lighter, #fee);
    border: 1px solid var(--b3-theme-error-light, #fcc);
  }

  .rtm-error-message--warning {
    background: var(--b3-theme-warning-lighter, #fff4e5);
    border-color: var(--b3-theme-warning-light, #ffe0b2);
  }

  .rtm-error-message--info {
    background: var(--b3-theme-info-lighter, #e3f2fd);
    border-color: var(--b3-theme-info-light, #b3d9ff);
  }

  .rtm-error-message__header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .rtm-error-message__icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .rtm-error-message__title {
    font-weight: 600;
    font-size: 15px;
    color: var(--b3-theme-error, #d32f2f);
    flex: 1;
  }

  .rtm-error-message--warning .rtm-error-message__title {
    color: var(--b3-theme-warning, #f57c00);
  }

  .rtm-error-message--info .rtm-error-message__title {
    color: var(--b3-theme-info, #1976d2);
  }

  .rtm-error-message__dismiss {
    background: none;
    border: none;
    color: var(--b3-theme-on-surface-light, #666);
    cursor: pointer;
    padding: 4px 8px;
    min-width: 44px;
    min-height: 44px;
    font-size: 18px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rtm-error-message__dismiss:hover {
    opacity: 1;
  }

  .rtm-error-message__dismiss:focus-visible {
    outline: 2px solid var(--b3-theme-primary, #4285f4);
    outline-offset: 2px;
    opacity: 1;
  }

  .rtm-error-message__content {
    margin-left: 32px;
  }

  .rtm-error-message__text {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--b3-theme-on-surface, #333);
    line-height: 1.5;
  }

  .rtm-error-message__hint {
    margin: 0;
    font-size: 13px;
    color: var(--b3-theme-on-surface-light, #666);
    font-style: italic;
    line-height: 1.5;
  }

  .rtm-error-message__actions {
    margin-top: 12px;
    margin-left: 32px;
  }

  .rtm-btn {
    padding: 8px 16px;
    min-width: 44px;
    min-height: 44px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .rtm-btn:focus-visible {
    outline: 2px solid var(--b3-theme-primary, #4285f4);
    outline-offset: 2px;
  }

  .rtm-btn--primary {
    background: var(--b3-theme-primary, #4285f4);
    color: white;
  }

  .rtm-btn--primary:hover {
    background: var(--b3-theme-primary-light, #5a95f5);
  }

  .rtm-btn--primary:active {
    transform: translateY(1px);
  }

  /* Accessibility: High Contrast Mode */
  @media (prefers-contrast: high) {
    .rtm-error-message {
      border-width: 2px;
    }

    .rtm-error-message--error {
      background: Canvas;
      border-color: CanvasText;
    }

    .rtm-error-message--warning {
      background: Canvas;
      border-color: CanvasText;
    }

    .rtm-error-message--info {
      background: Canvas;
      border-color: CanvasText;
    }

    .rtm-error-message__title,
    .rtm-error-message__text,
    .rtm-error-message__hint {
      color: CanvasText;
      font-weight: 600;
    }

    .rtm-btn--primary {
      border: 2px solid CanvasText;
    }

    .rtm-error-message__dismiss {
      border: 1px solid CanvasText;
    }
  }

  /* Accessibility: Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .rtm-error-message__dismiss,
    .rtm-btn {
      transition: none;
    }

    .rtm-btn--primary:active {
      transform: none;
    }
  }
</style>
