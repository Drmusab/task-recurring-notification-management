# Shared Utilities and Types

This directory contains code shared between backend and frontend layers: utilities, type definitions, constants, and configuration.

## Directory Structure

```
shared/
├── assets/                   # Shared assets
│   └── icons/                # Icon definitions
├── config/                   # Configuration
│   ├── Settings.ts           # Settings interfaces
│   ├── StatusConfiguration.ts # Task status configuration
│   ├── WebhookConfig.ts      # Webhook configuration
│   └── setting-utils.ts      # Settings utilities
├── constants/                # Constants and enums
│   ├── statuses/             # Status constants
│   └── misc-constants.ts     # Miscellaneous constants
└── utils/                    # Shared utilities
    ├── compat/               # Compatibility layer
    │   ├── daily-notes-compat.ts # Daily notes compatibility
    │   └── siyuan-compat.ts  # SiYuan compatibility shims
    ├── date/                 # Date utilities
    │   ├── date.ts           # Date manipulation functions
    │   └── timezone.ts       # Timezone utilities
    ├── dateTime/             # DateTime utilities (legacy)
    ├── function/             # Function utilities
    │   └── debounce.ts       # Debounce utility
    ├── lib/                  # External library wrappers
    ├── search/               # Search utilities
    │   └── fuzzy-search.ts   # Fuzzy search implementation
    ├── string/               # String utilities
    │   └── placeholder-resolver.ts # Placeholder resolution
    └── task/                 # Task-related utilities
        ├── link-resolver.ts  # Task link resolution
        ├── link.ts           # Link utilities
        ├── list-item.ts      # List item utilities
        ├── occurrence.ts     # Occurrence utilities
        ├── on-completion.ts  # Completion handlers
        ├── priority.ts       # Priority utilities
        ├── recurrence.ts     # Recurrence utilities
        ├── reorder-tasks.ts  # Task reordering
        ├── signifiers.ts     # Emoji signifiers
        ├── snooze.ts         # Snooze functionality
        ├── task-dependency.ts # Dependency utilities
        ├── task-location.ts  # Location utilities
        ├── task-regular-expressions.ts # Task regex patterns
        ├── task-templates.ts # Task templates
        └── urgency.ts        # Urgency calculations
```

## Key Concepts

### Import Paths
Use `@shared` alias for shared utilities:

```typescript
// ✅ Correct
import { startOfDay } from '@shared/utils/date/date';
import { EMOJI_SIGNIFIERS } from '@shared/utils/task/signifiers';
import { Settings } from '@shared/config/Settings';
import { Notice } from '@shared/utils/compat/siyuan-compat';

// ❌ Avoid
import { startOfDay } from '../../../shared/utils/date/date';
```

### Layer Separation Rules

**Shared code MUST NOT:**
- ❌ Import from `@backend`
- ❌ Import from `@frontend`
- ❌ Contain business logic
- ❌ Have side effects (except utilities)

**Shared code SHOULD:**
- ✅ Be pure functions where possible
- ✅ Export types and interfaces
- ✅ Provide utility functions
- ✅ Define constants and configuration

## Directory Guidelines

### `/config`
Configuration interfaces and settings utilities. These define the shape of configuration data but don't contain business logic.

```typescript
export interface Settings {
  enableNotifications: boolean;
  theme: 'light' | 'dark';
}
```

### `/constants`
Application-wide constants that never change:

```typescript
export const MAX_RECENT_COMPLETIONS = 10;
export const SCHEDULER_INTERVAL_MS = 60000;
```

### `/utils/compat`
Compatibility shims for SiYuan/Obsidian API differences. Allows code to work across platforms:

```typescript
export interface Notice {
  // Shim for SiYuan notice API
}
```

### `/utils/date`
Date manipulation and timezone utilities:

```typescript
export function startOfDay(date: Date): Date {
  // Returns date at 00:00:00
}
```

### `/utils/function`
Higher-order function utilities:

```typescript
export function debounce<T>(fn: T, wait: number): T {
  // Debounce implementation
}
```

### `/utils/search`
Search and filtering utilities:

```typescript
export function fuzzySearchTasks(query: string, tasks: Task[]): Task[] {
  // Fuzzy search implementation
}
```

### `/utils/string`
String manipulation utilities:

```typescript
export function placeholderResolver(template: string, context: any): string {
  // Resolves {{placeholder}} in strings
}
```

### `/utils/task`
Task-specific utilities that don't contain business logic:

```typescript
export const EMOJI_SIGNIFIERS = {
  priority: {
    high: '🔺',
    medium: '🔼',
    low: '🔽'
  }
};
```

## Testing
Shared utilities should be:
- ✅ Pure functions (deterministic)
- ✅ Well-tested with unit tests
- ✅ Free of side effects
- ✅ Framework-agnostic

## Migration Notes

### Reorganization (Phase 2)
Previously, shared utilities were in `shared/utils/misc/`, which became a catch-all for unrelated code. The reorganization into semantic categories makes imports more discoverable:

**Before:**
```typescript
import { logger } from '@shared/utils/misc/logger';
import { debounce } from '@shared/utils/misc/debounce';
import { siyuanCompat } from '@shared/utils/misc/siyuan-compat';
```

**After:**
```typescript
import * as logger from '@backend/logging/logger'; // Moved to backend
import { debounce } from '@shared/utils/function/debounce';
import { Notice } from '@shared/utils/compat/siyuan-compat';
```

## Related Documentation
- [Naming Conventions](../docs/NAMING_CONVENTIONS.md)
- [Phase 2 Completion Summary](../PHASE2_COMPLETION_SUMMARY.md)
