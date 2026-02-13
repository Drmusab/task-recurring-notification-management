<script lang="ts">
  /**
   * Keyboard Shortcuts Help Dialog
   * 
   * Displays all available keyboard shortcuts organized by category
   * 
   * @module KeyboardShortcutsHelp
   */

  import { onMount } from "svelte";
  import type { KeyboardShortcutManager } from "../../utils/keyboardShortcuts";

  export let shortcutManager: KeyboardShortcutManager;
  export let onClose: () => void;

  interface ShortcutGroup {
    category: string;
    shortcuts: Array<{ id: string; keys: string; description: string }>;
  }

  let groups: ShortcutGroup[] = [];

  onMount(() => {
    const allShortcuts = shortcutManager.getAllShortcuts();

    // Organize by category
    const categories: Record<string, typeof allShortcuts> = {
      "Task Management": [],
      "Query Operations": [],
      "Navigation": [],
      "General": [],
    };

    allShortcuts.forEach((item) => {
      const desc = item.shortcut.description.toLowerCase();
      if (desc.includes("task")) {
        categories["Task Management"].push(item);
      } else if (desc.includes("query") || desc.includes("search")) {
        categories["Query Operations"].push(item);
      } else if (desc.includes("toggle") || desc.includes("focus")) {
        categories["Navigation"].push(item);
      } else {
        categories["General"].push(item);
      }
    });

    groups = Object.entries(categories)
      .filter(([, shortcuts]) => shortcuts.length > 0)
      .map(([category, shortcuts]) => ({
        category,
        shortcuts: shortcuts.map((item) => ({
          id: item.id,
          keys: shortcutManager.formatShortcut(item.shortcut),
          description: item.shortcut.description,
        })),
      }));
  });

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="rtm-shortcuts-overlay" on:click={onClose} role="presentation">
  <div
    class="rtm-shortcuts-dialog"
    on:click|stopPropagation
    role="dialog"
    aria-labelledby="shortcuts-title"
    aria-modal="true"
  >
    <div class="rtm-shortcuts-header">
      <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
      <button
        class="rtm-shortcuts-close"
        on:click={onClose}
        aria-label="Close shortcuts help"
        type="button"
      >
        ✕
      </button>
    </div>

    <div class="rtm-shortcuts-content">
      {#each groups as group}
        <div class="rtm-shortcuts-group">
          <h3 class="rtm-shortcuts-group-title">{group.category}</h3>
          <div class="rtm-shortcuts-list">
            {#each group.shortcuts as shortcut}
              <div class="rtm-shortcut-item">
                <kbd class="rtm-shortcut-keys">{shortcut.keys}</kbd>
                <span class="rtm-shortcut-description">{shortcut.description}</span>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="rtm-shortcuts-footer">
      <p class="rtm-shortcuts-hint">
        Press <kbd>Esc</kbd> to close this dialog
      </p>
    </div>
  </div>
</div>

<style>
  .rtm-shortcuts-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .rtm-shortcuts-dialog {
    background: var(--b3-theme-surface, white);
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .rtm-shortcuts-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--b3-theme-surface-lighter, #eee);
  }

  .rtm-shortcuts-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--b3-theme-on-surface, #333);
  }

  .rtm-shortcuts-close {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--b3-theme-on-surface-light, #666);
    cursor: pointer;
    padding: 4px 8px;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .rtm-shortcuts-close:hover {
    opacity: 1;
  }

  .rtm-shortcuts-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }

  .rtm-shortcuts-group {
    margin-bottom: 28px;
  }

  .rtm-shortcuts-group:last-child {
    margin-bottom: 0;
  }

  .rtm-shortcuts-group-title {
    margin: 0 0 12px 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--b3-theme-primary, #4285f4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .rtm-shortcuts-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rtm-shortcut-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 8px 12px;
    background: var(--b3-theme-surface-light, #f9f9f9);
    border-radius: 4px;
  }

  .rtm-shortcut-keys {
    background: white;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 4px;
    padding: 4px 8px;
    font-family: "SF Mono", Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-surface, #333);
    min-width: 100px;
    text-align: center;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .rtm-shortcut-description {
    flex: 1;
    font-size: 14px;
    color: var(--b3-theme-on-surface, #333);
  }

  .rtm-shortcuts-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--b3-theme-surface-lighter, #eee);
    background: var(--b3-theme-surface-light, #f9f9f9);
  }

  .rtm-shortcuts-hint {
    margin: 0;
    font-size: 13px;
    color: var(--b3-theme-on-surface-light, #666);
    text-align: center;
  }

  .rtm-shortcuts-hint kbd {
    background: white;
    border: 1px solid var(--b3-theme-surface-lighter, #ddd);
    border-radius: 3px;
    padding: 2px 6px;
    font-family: "SF Mono", Monaco, Consolas, monospace;
    font-size: 12px;
  }
</style>
