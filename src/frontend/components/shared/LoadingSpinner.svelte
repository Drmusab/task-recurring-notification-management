<script lang="ts">
  /**
   * Reusable Loading Spinner Component
   * 
   * Provides consistent loading states across the application
   * with accessibility features
   * 
   * @module LoadingSpinner
   */

  export let size: "small" | "medium" | "large" = "medium";
  export let message: string = "Loading...";
  export let inline: boolean = false;
  export let ariaLabel: string = message;
  export let busy: boolean = true; // Controls aria-busy state
</script>

<div 
  class="rtm-loading-spinner rtm-loading-spinner--{size}"
  class:rtm-loading-spinner--inline={inline}
  role="status"
  aria-live="polite"
  aria-busy={busy}
  aria-label={ariaLabel}
>
  <div class="rtm-loading-spinner__animation">
    <svg viewBox="0 0 50 50" class="rtm-loading-spinner__svg">
      <circle
        cx="25"
        cy="25"
        r="20"
        fill="none"
        stroke="currentColor"
        stroke-width="4"
        stroke-dasharray="80, 200"
        stroke-dashoffset="0"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 25 25"
          to="360 25 25"
          dur="1s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  </div>
  {#if message}
    <div class="rtm-loading-spinner__message">{message}</div>
  {/if}
</div>

<style>
  .rtm-loading-spinner {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 24px;
  }

  .rtm-loading-spinner--inline {
    flex-direction: row;
    padding: 8px;
  }

  .rtm-loading-spinner--small .rtm-loading-spinner__animation {
    width: 20px;
    height: 20px;
  }

  .rtm-loading-spinner--medium .rtm-loading-spinner__animation {
    width: 32px;
    height: 32px;
  }

  .rtm-loading-spinner--large .rtm-loading-spinner__animation {
    width: 48px;
    height: 48px;
  }

  .rtm-loading-spinner__animation {
    color: var(--b3-theme-primary, #4285f4);
  }

  .rtm-loading-spinner__svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  .rtm-loading-spinner__message {
    font-size: 14px;
    color: var(--b3-theme-on-surface-light, #666);
    text-align: center;
  }

  .rtm-loading-spinner--inline .rtm-loading-spinner__message {
    font-size: 13px;
  }

  /* Accessibility: High Contrast Mode */
  @media (prefers-contrast: high) {
    .rtm-loading-spinner__animation {
      color: CanvasText;
      filter: contrast(1.5);
    }

    .rtm-loading-spinner__message {
      color: CanvasText;
      font-weight: 600;
    }

    .rtm-loading-spinner {
      border: 2px solid CanvasText;
      background: Canvas;
    }
  }

  /* Accessibility: Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .rtm-loading-spinner__svg animateTransform {
      animation-duration: 0s !important;
    }

    .rtm-loading-spinner__svg circle {
      stroke-dasharray: 125, 0; /* Show as complete circle */
      opacity: 0.7;
    }

    .rtm-loading-spinner__animation {
      /* Pulse effect instead of rotation */
      animation: pulse 2s ease-in-out infinite;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 0.5;
    }
    50% {
      opacity: 1;
    }
  }
</style>
