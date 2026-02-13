# Accessible Shared Components

This directory contains WCAG 2.1 AA compliant shared UI components for the SiYuan Task Management Plugin.

## Components

### Icon.svelte
SVG icon component with accessibility support.

**Features:**
- Decorative icons (aria-hidden) vs. semantic icons (role="img")
- Theme-aware (adapts to dark/light mode)
- High contrast mode support
- Sizes: 16px, 20px, 24px

**Usage:**
```svelte
import { Icon } from '@/components/shared';

<!-- Decorative icon -->
<Icon category="navigation" name="inbox" size={16} />

<!-- Semantic icon -->
<Icon category="status" name="warning" size={20} alt="Warning" />
```

---

### Button.svelte
Accessible button component with loading states.

**Features:**
- 44x44px minimum touch targets
- Visible focus indicators
- Loading and disabled states
- Variants: primary, secondary, danger, ghost
- Sizes: small (32px), medium (44px), large (48px)

**Usage:**
```svelte
import { Button } from '@/components/shared';

<Button 
  variant="primary" 
  size="medium"
  ariaLabel="Save task"
  loading={isSaving}
  on:click={handleSave}
>
  Save
</Button>
```

---

### Tooltip.svelte
WCAG 1.4.13 compliant tooltip.

**Features:**
- Dismissible (Escape key)
- Hoverable (doesn't disappear on hover)
- Persistent (until focus/hover removed)
- Positions: top, bottom, left, right
- 300ms delay to prevent accidental triggers

**Usage:**
```svelte
import { Tooltip } from '@/components/shared';

<Tooltip text="Edit this task" position="top">
  <button>Edit</button>
</Tooltip>
```

---

### Dropdown.svelte
Accessible dropdown with ARIA combobox pattern.

**Features:**
- Keyboard navigation (Arrow keys, Enter, Escape)
- ARIA combobox + listbox pattern
- Support for disabled options
- Required field indication
- 44x44px minimum touch targets

**Usage:**
```svelte
import { Dropdown } from '@/components/shared';

<Dropdown 
  label="Priority"
  options={[
    { value: 'low', label: 'Low priority' },
    { value: 'high', label: 'High priority', disabled: false }
  ]}
  bind:value={priority}
  required={true}
  on:change={handleChange}
/>
```

---

### ContextMenu.svelte
Accessible context menu with ARIA menu pattern.

**Features:**
- Keyboard navigation (Arrow keys, Enter, Escape)
- Focus management (saves/restores focus)
- Roving tabindex
- Support for separators and disabled items
- Danger variant for destructive actions

**Usage:**
```svelte
import { ContextMenu } from '@/components/shared';

<script>
  let contextMenu;
  
  function handleRightClick(event) {
    event.preventDefault();
    contextMenu.open({ x: event.clientX, y: event.clientY });
  }
</script>

<div on:contextmenu={handleRightClick}>
  Right-click me
</div>

<ContextMenu
  bind:this={contextMenu}
  items={[
    { id: '1', label: 'Edit', icon: '✏️' },
    { separator: true },
    { id: '2', label: 'Delete', icon: '🗑️', danger: true }
  ]}
  on:select={handleMenuSelect}
/>
```

---

## Accessibility Standards

All components meet WCAG 2.1 Level AA requirements:

- **2.1.1 Keyboard:** All functionality accessible via keyboard
- **2.4.7 Focus Visible:** 2px outline + 4px shadow indicators
- **2.5.5 Target Size:** Minimum 44x44px touch targets
- **1.4.3 Contrast:** 4.5:1 text, 3:1 UI components
- **1.4.11 Non-text Contrast:** Enhanced borders in high contrast mode
- **4.1.2 Name, Role, Value:** Proper ARIA attributes

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Screen readers: NVDA, JAWS, VoiceOver

## Testing

Each component has been tested with:
- ✅ Keyboard-only navigation
- ✅ Screen readers (NVDA, JAWS, VoiceOver)
- ✅ High contrast mode (Windows, macOS)
- ✅ Reduced motion preferences
- ✅ Zoom up to 200%

## References

- [WAI-ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
