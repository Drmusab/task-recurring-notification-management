<script lang="ts">
  /**
   * Accessible Context Menu Component
   * WCAG 2.1 AA Compliant
   * 
   * @accessibility
   * - Uses ARIA menu pattern
   * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
   * - role="menu" and role="menuitem"
   * - Focus management with roving tabindex
   * - Closes on Escape and outside click
   * - 44x44px minimum touch targets
   * - Screen reader friendly
   * 
   * @reference https://www.w3.org/WAI/ARIA/apg/patterns/menu/
   */

  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { generateAriaId } from '@frontend/utils/accessibility';

  export let items: Array<{
    id: string;
    label: string;
    icon?: string;
    disabled?: boolean;
    danger?: boolean;
    separator?: boolean;
  }> = [];
  export let isOpen = false;
  export let position: { x: number; y: number } | undefined = undefined;
  export let ariaLabel = 'Context menu';

  const dispatch = createEventDispatcher();
  const menuId = generateAriaId('context-menu');

  let focusedIndex = 0;
  let menuElement: HTMLElement | undefined;
  let previousFocus: HTMLElement | null = null;

  $: menuItems = items.filter(item => !item.separator);

  function open(pos: { x: number; y: number }) {
    previousFocus = document.activeElement as HTMLElement;
    position = pos;
    isOpen = true;
    focusedIndex = 0;
    
    // Focus menu after opening
    setTimeout(() => {
      menuElement?.focus();
    }, 0);
  }

  function close() {
    isOpen = false;
    position = undefined;
    
    // Restore focus to previous element
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  function selectItem(item: typeof items[0]) {
    if (item.disabled || item.separator) return;
    
    dispatch('select', { item });
    close();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusedIndex = (focusedIndex + 1) % menuItems.length;
        // Skip disabled items
        while (menuItems[focusedIndex]?.disabled && focusedIndex < menuItems.length - 1) {
          focusedIndex++;
        }
        break;

      case 'ArrowUp':
        event.preventDefault();
        focusedIndex = focusedIndex === 0 ? menuItems.length - 1 : focusedIndex - 1;
        // Skip disabled items
        while (menuItems[focusedIndex]?.disabled && focusedIndex > 0) {
          focusedIndex--;
        }
        break;

      case 'Home':
        event.preventDefault();
        focusedIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        focusedIndex = menuItems.length - 1;
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        const selectedItem = menuItems[focusedIndex];
        if (selectedItem) {
          selectItem(selectedItem);
        }
        break;

      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  }

  function handleClickOutside(event: MouseEvent) {
    if (isOpen && menuElement && !menuElement.contains(event.target as Node)) {
      close();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('click', handleClickOutside);
  });

  // Expose open/close methods
  export { open, close };
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen && position}
  <div
    bind:this={menuElement}
    id={menuId}
    role="menu"
    class="context-menu"
    style="left: {position.x}px; top: {position.y}px;"
    aria-label={ariaLabel}
    tabindex="-1"
  >
    {#each items as item, index}
      {#if item.separator}
        <div role="separator" class="menu-separator" aria-hidden="true"></div>
      {:else}
        {@const itemIndex = menuItems.indexOf(item)}
        <button
          role="menuitem"
          class="menu-item"
          class:menu-item-focused={itemIndex === focusedIndex}
          class:menu-item-danger={item.danger}
          class:menu-item-disabled={item.disabled}
          aria-disabled={item.disabled}
          tabindex={itemIndex === focusedIndex ? 0 : -1}
          on:click={() => selectItem(item)}
          on:mouseenter={() => focusedIndex = itemIndex}
        >
          {#if item.icon}
            <span class="menu-item-icon" aria-hidden="true">{item.icon}</span>
          {/if}
          <span class="menu-item-label">{item.label}</span>
        </button>
      {/if}
    {/each}
  </div>
{/if}

<style>
  .context-menu {
    position: fixed;
    z-index: 10000;
    min-width: 200px;
    background: var(--background-primary, #ffffff);
    border: 1px solid var(--background-modifier-border, #d1d5db);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 0.25rem;
    outline: none;
  }

  .menu-item {
    /* WCAG 2.5.5 Target Size - Minimum 44x44px */
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: transparent;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    color: var(--text-normal, #1f2937);
    text-align: left;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .menu-item:hover:not(.menu-item-disabled) {
    background: var(--background-modifier-hover, #f3f4f6);
  }

  /* WCAG 2.4.7 Focus Visible */
  .menu-item-focused {
    background: var(--background-modifier-hover, #f3f4f6);
    outline: 2px solid var(--interactive-accent, #1976d2);
    outline-offset: -2px;
  }

  .menu-item-danger {
    color: var(--text-error, #ef4444);
  }

  .menu-item-danger:hover:not(.menu-item-disabled) {
    background: rgba(239, 68, 68, 0.1);
  }

  .menu-item-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .menu-item-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .menu-item-label {
    flex: 1;
  }

  .menu-separator {
    height: 1px;
    background: var(--background-modifier-border, #e5e7eb);
    margin: 0.25rem 0;
  }

  /* WCAG High Contrast Mode */
  @media (prefers-contrast: high) {
    .context-menu {
      border-width: 2px;
    }
    
    .menu-separator {
      height: 2px;
    }
  }

  /* WCAG Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .menu-item {
      transition: none;
    }
  }

  /* Fade animation for users who allow motion */
  @media (prefers-reduced-motion: no-preference) {
    .context-menu {
      animation: fadeIn 0.15s ease-out;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
  }
</style>
