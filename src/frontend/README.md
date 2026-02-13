# Frontend Architecture

This directory contains all UI components, stores, and client-side logic for the Shehab-Note recurring task plugin dashboard.

## Directory Structure

```
frontend/
├── components/               # UI components
│   ├── analytics/            # Analytics visualizations
│   │   ├── insight-table/    # Task insight tables
│   │   ├── overview/         # Overview widgets
│   │   ├── select/           # Analytics selectors
│   │   ├── widgets/          # Analytics widgets
│   │   └── work-items/       # Work item components
│   ├── calendar/             # Calendar components
│   │   ├── io/               # Daily/weekly note I/O
│   │   ├── testUtils/        # Calendar test utilities
│   │   └── ui/               # Calendar UI components
│   ├── common/               # Shared UI components
│   │   ├── Menus/            # Context menus
│   │   ├── DependencyHelpers.ts # Dependency selection
│   │   └── EditTaskUnified.ts # Unified task editor
│   ├── dashboard/            # Dashboard components
│   ├── reminders/            # Reminder UI components
│   │   └── ui/               # Reminder UI elements
│   └── tracker/              # Task tracker components
├── hooks/                    # Custom React/Svelte hooks
│   ├── keyboard.ts           # Keyboard event handling
│   ├── keyboard-state.ts     # Keyboard state management
│   └── use-keyboard-mode.ts  # Keyboard mode hook
├── modals/                   # Modal dialogs
│   ├── OptionsModal.ts       # Options dialog
│   └── TaskModal.ts          # Task editor modal
├── stores/                   # State management (Svelte stores)
│   ├── bulk-selection.store.ts # Bulk selection state
│   ├── i18n.store.ts         # Internationalization
│   ├── keyboard-shortcuts.store.ts # Keyboard shortcuts
│   ├── search.store.ts       # Search state
│   ├── task-analytics.store.ts # Analytics state
│   └── task-order.store.ts   # Task ordering state
├── styles/                   # Global styles
│   ├── main.scss             # Main stylesheet
│   ├── optimistic-ui.scss    # Optimistic update styles
│   └── themes/               # Theme definitions
├── utils/                    # Frontend utilities
│   ├── shortcuts.ts          # Keyboard shortcut definitions
│   └── ...
└── views/                    # Main views/pages
    ├── TrackerDashboard.svelte # Main dashboard view
    └── ...
```

## Key Concepts

### Import Paths
Use absolute imports with frontend alias:

```typescript
// ✅ Correct
import { TaskModal } from '@frontend/modals/TaskModal';
import { useKeyboardMode } from '@frontend/hooks/use-keyboard-mode';
import { searchStore } from '@stores/search.store';

// ❌ Avoid
import { TaskModal } from '../modals/TaskModal';
```

### Store Naming Convention
All stores follow kebab-case with `.store.ts` suffix:

```typescript
task-order.store.ts
search.store.ts
keyboard-shortcuts.store.ts
```

### Component Organization
- **analytics/** - Data visualization and insights
- **calendar/** - Calendar-related UI
- **common/** - Reusable components across features
- **dashboard/** - Main dashboard UI
- **reminders/** - Reminder-specific UI
- **tracker/** - Task tracking UI

### Layer Separation
Frontend components should:
- ✅ Import from `@backend` for business logic
- ✅ Import from `@shared` for utilities and types
- ❌ Never contain business logic (use backend services)

## State Management

### Svelte Stores
State is managed using Svelte's reactive stores:

```typescript
import { writable, derived } from 'svelte/store';

export const searchStore = writable({
  query: '',
  filters: []
});
```

### Store Access in Components
```svelte
<script lang="ts">
  import { searchStore } from '@stores/search.store';
  
  // Subscribe with $ prefix
  $: currentQuery = $searchStore.query;
</script>
```

## Component Patterns

### Props and Events
```svelte
<script lang="ts">
  import type { Task } from '@backend/core/models/Task';
  
  export let task: Task;
  export let onComplete: (taskId: string) => void;
</script>

<button on:click={() => onComplete(task.id)}>
  Complete
</button>
```

### Reactive Statements
```svelte
<script lang="ts">
  let count = 0;
  
  // Reactive - recalculates when count changes
  $: doubled = count * 2;
</script>
```

## Styling

### SCSS Organization
- `main.scss` - Global styles and imports
- `optimistic-ui.scss` - Optimistic update animations
- Component styles - Use `<style>` blocks in `.svelte` files

### Theme System
Themes are defined in `styles/themes/`, supporting dark/light modes.

## Testing
- Component tests: Co-located with components
- Integration tests: `tests/integration/`
- Use Vitest with jsdom environment

## Related Documentation
- [Split View Dashboard](../docs/split-view-dashboard.md)
- [Keyboard Shortcuts](../docs/keyboard-shortcuts-reference.md)
- [Optimistic Updates](../docs/OPTIMISTIC_UPDATE_GUIDE.md)
