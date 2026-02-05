# Icon System Documentation

## Overview

This project uses a professional SVG icon system to replace emoji-based UI icons. The icon system provides:

- **Consistent rendering** across all platforms (Windows, macOS, Linux)
- **Accessibility** - proper alt text and semantic markup
- **Size control** - precise sizing for different contexts
- **Theme support** - icons adapt to dark/light mode via CSS
- **Professional appearance** - clean, modern design
- **HiDPI support** - crisp rendering on Retina displays

## Directory Structure

```
src/assets/icons/
├── navigation/     # Tab icons (16×16)
├── actions/        # Button icons (16×16, 20×20)
├── status/         # Indicators (16×16, 20×20)
├── features/       # Feature icons (24×24)
└── index.ts        # Central icon registry
```

## Icon Categories

### Navigation Icons (16×16)
Used in tab navigation and primary navigation elements.

- `inbox` - Inbox tray
- `today` - Calendar with today indicator
- `calendar` - Calendar view
- `done` - Checkmark in box
- `folder` - Folder/project container
- `search` - Magnifying glass
- `list` - List view
- `insights` - Light bulb

### Action Icons (16×16, 20×20)
Used for buttons and interactive elements.

- `close` - X mark (16×16)
- `check` - Checkmark (16×16, 20×20)
- `delay` - Clock (20×20)
- `skip` - Forward arrow (20×20)
- `save` - Disk/save icon (20×20)
- `refresh` - Circular arrow (16×16, 20×20)
- `delete` - Trash can (16×16, 20×20)
- `import` - Upload arrow (20×20)

### Status Icons (16×16, 20×20)
Used for status indicators and badges.

- `warning` - Triangle with exclamation (16×16, 20×20)
- `trophy` - Achievement trophy (16×16)
- `streak` - Flame icon (16×16)
- `clock` - Alarm clock (16×16)

### Feature Icons (24×24)
Used for larger feature representations.

- `suggestion` - Light bulb (24×24)
- `analytics` - Bar chart (24×24)
- `consolidate` - Package/box (24×24)
- `delegate` - Multiple people (24×24)

## Usage

### Basic Usage

Import the Icon component and use it with category, name, and size:

```svelte
<script>
  import Icon from '@/components/ui/Icon.svelte';
</script>

<Icon category="navigation" name="inbox" size={16} alt="Inbox" />
<Icon category="actions" name="check" size={20} alt="Confirm" />
<Icon category="status" name="warning" size={16} alt="Warning" />
```

### Props

- `category` (required): Icon category - 'navigation', 'actions', 'status', or 'features'
- `name` (required): Icon name within the category
- `size` (optional): Icon size - 16, 20, or 24 (default: 16)
- `alt` (optional): Alt text for accessibility
- `class` (optional): Additional CSS classes

### Example: Navigation Tab

```svelte
<button class="tab">
  <Icon category="navigation" name="inbox" size={16} alt="Inbox" />
  Inbox
</button>
```

### Example: Action Button

```svelte
<button onclick={handleDelete}>
  <Icon category="actions" name="delete" size={20} alt="Delete" />
  Delete
</button>
```

### Example: Status Indicator

```svelte
{#if hasStreak}
  <span class="streak">
    <Icon category="status" name="streak" size={16} alt="Streak" />
    {task.currentStreak}
  </span>
{/if}
```

## Styling

Icons automatically use `currentColor` for their stroke/fill, allowing them to inherit text color:

```css
.my-button {
  color: #3b82f6; /* Icon will be blue */
}

.my-button:hover {
  color: #2563eb; /* Icon will be darker blue on hover */
}
```

## Fallback Behavior

If an icon is not found, a fallback placeholder is shown with a "?" character. This helps identify missing icons during development.

## Generating New Icons

To add new icons:

1. Add the SVG definition to `scripts/generate-icons.js`
2. Run `node scripts/generate-icons.js`
3. Update `src/assets/icons/index.ts` to include the new icon
4. Rebuild the project

## File Naming Convention

Icon files follow this naming pattern:

```
<category>-<name>-<size>.svg

Examples:
navigation-inbox-16.svg
actions-delete-20.svg
status-warning-16.svg
features-analytics-24.svg
```

## Icon Standards

All icons follow these design standards:

- **Monochrome outline style** with single-weight strokes
- **Transparent background** (SVG format)
- **Consistent stroke width** (1.5px for 16×16, 2px for 20×24)
- **Rounded corners** for a friendly feel
- **Optimized for small sizes** - clear and readable at 16×16

## Migration from Emoji

The icon system replaced these emoji icons:

| Old Emoji | New Icon | Category | Name |
|-----------|----------|----------|------|
| 📥 | Icon | navigation | inbox |
| 📋 | Icon | navigation | today |
| 📅 | Icon | navigation | calendar |
| ✅ | Icon | navigation | done |
| 📁 | Icon | navigation | folder |
| 🔍 | Icon | navigation | search |
| 📝 | Icon | navigation | list |
| 💡 | Icon | navigation | insights |
| ✕ | Icon | actions | close |
| ✓ | Icon | actions | check |
| 🕒 | Icon | actions | delay |
| ⏭️ | Icon | actions | skip |
| 💾 | Icon | actions | save |
| 🔄 | Icon | actions | refresh |
| 🗑️ | Icon | actions | delete |
| ⬆️ | Icon | actions | import |
| ⚠ | Icon | status | warning |
| 🏆 | Icon | status | trophy |
| 🔥 | Icon | status | streak |
| ⏰ | Icon | status | clock |
| 💡 | Icon | features | suggestion |
| 📊 | Icon | features | analytics |
| 📦 | Icon | features | consolidate |
| 👥 | Icon | features | delegate |

## TypeScript Support

The icon system is fully typed:

```typescript
import { type IconCategory, type IconSize } from '@/assets/icons';

const category: IconCategory = 'navigation';
const size: IconSize = 16;
```

## Benefits

1. **Cross-platform consistency** - Icons look the same on all operating systems
2. **Accessibility** - Screen readers can announce icon purpose via alt text
3. **Precise sizing** - Icons are exactly the size you specify
4. **Theme compatibility** - Icons inherit color from their context
5. **Professional appearance** - Clean, modern design suitable for enterprise use
6. **Maintainability** - Centralized icon management and easy updates
