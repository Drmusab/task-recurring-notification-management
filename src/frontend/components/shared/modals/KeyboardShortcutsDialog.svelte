<script lang="ts">
  /**
   * KeyboardShortcutsDialog Component
   * WCAG 2.1 AA Compliant
   * 
   * Wrapper component for displaying keyboard shortcuts help dialog
   * 
   * @accessibility
   * - Delegates to KeyboardShortcutsHelp component
   * - role="dialog" with proper ARIA attributes
   * - Keyboard navigation (Tab, Escape)
   * - 44x44px minimum touch targets
   * - High contrast mode support
   */

  import KeyboardShortcutsHelp from '../KeyboardShortcutsHelp.svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export let shortcutManager: any;
  export let onClose: () => void;
</script>

<KeyboardShortcutsHelp {shortcutManager} {onClose} />
