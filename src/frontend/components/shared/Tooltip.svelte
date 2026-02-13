<script lang="ts">
  /**
   * Accessible Tooltip Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - WCAG 1.4.13 Content on Hover/Focus: Dismissible, hoverable, persistent
   * - Uses aria-describedby pattern for screen readers
   * - Keyboard accessible (Escape to dismiss)
   * - Respects prefers-reduced-motion
   * - High contrast mode support
   * - Does not hide or obscure content
   * 
   * @reference https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/
   */

  import { onMount, onDestroy } from 'svelte';
  import { generateAriaId } from '@frontend/utils/accessibility';

  export let text: string;
  export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
  export let delay = 300; // ms before showing tooltip
  export let id: string = generateAriaId('tooltip');

  let visible = false;
  let timeoutId: number | undefined;
  let tooltipElement: HTMLElement | undefined;

  function show() {
    timeoutId = window.setTimeout(() => {
      visible = true;
    }, delay);
  }

  function hide() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
    visible = false;
  }

  function handleKeydown(event: KeyboardEvent) {
    // WCAG 1.4.13: Dismissible via Escape key
    if (event.key === 'Escape') {
      hide();
    }
  }

  onDestroy(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
</script>

<div class="tooltip-wrapper">
  <div
    class="tooltip-trigger"
    role="button"
    tabindex="0"
    aria-describedby={visible ? id : undefined}
    on:mouseenter={show}
    on:mouseleave={hide}
    on:focus={show}
    on:blur={hide}
    on:keydown={handleKeydown}
  >
    <slot />
  </div>
  
  {#if visible}
    <div
      {id}
      role="tooltip"
      class="tooltip tooltip-{position}"
      bind:this={tooltipElement}
      on:mouseenter={show}
      on:mouseleave={hide}
    >
      {text}
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-block;
  }

  .tooltip-trigger {
    display: inline-block;
  }

  .tooltip {
    position: absolute;
    z-index: 9999;
    padding: 0.5rem 0.75rem;
    background: var(--background-primary, #1f2937);
    color: var(--text-on-accent, #ffffff);
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    max-width: 300px;
    word-wrap: break-word;
    white-space: normal;
    
    /* WCAG 1.4.13 Content on Hover: Persistent (doesn't disappear on hover) */
    pointer-events: auto;
    
    /* Shadow for visibility */
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  /* Position variants */
  .tooltip-top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  .tooltip-right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  /* Arrow indicators (optional visual enhancement) */
  .tooltip::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border: 4px solid transparent;
  }

  .tooltip-top::after {
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-top-color: var(--background-primary, #1f2937);
  }

  .tooltip-bottom::after {
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-bottom-color: var(--background-primary, #1f2937);
  }

  .tooltip-left::after {
    left: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-left-color: var(--background-primary, #1f2937);
  }

  .tooltip-right::after {
    right: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-right-color: var(--background-primary, #1f2937);
  }

  /* WCAG 1.4.3 Contrast: Ensure 4.5:1 ratio */
  @media (prefers-contrast: high) {
    .tooltip {
      background: #000000;
      border: 2px solid #ffffff;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .tooltip {
      transition: none;
    }
  }

  /* Fade animation for users who allow motion */
  @media (prefers-reduced-motion: no-preference) {
    .tooltip {
      animation: fadeIn 0.15s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  }
</style>
