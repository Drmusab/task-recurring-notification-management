# SiYuan Task Management Plugin - AI Agent Instructions

## Project Overview
Advanced recurring task management plugin for **SiYuan/Shehab-Note** (note-taking system). Built with TypeScript, Svelte, and Vite. Supports inline task creation with emoji metadata, AI-driven suggestions, multi-channel webhooks, and sophisticated recurrence engine.

## Architecture & Core Patterns

### Singleton Service Managers
The codebase uses singleton patterns extensively. Key managers (see [src/core/managers/TaskManager.ts](src/core/managers/TaskManager.ts)):
- **TaskManager**: Central singleton coordinating all task services. Always access via `TaskManager.getInstance(plugin)`
- Initialize order: Settings → Storage → Events → Scheduler → PatternLearner
- Never instantiate managers directly; use the singleton getInstance pattern

### Data Flow & Persistence
**Storage architecture** ([src/core/storage/TaskStorage.ts](src/core/storage/TaskStorage.ts)):
- Active tasks: In-memory Map + persisted to SiYuan storage API
- Archived tasks: Chunked on-demand loading (performance optimization)
- Triple indexing: `blockIndex` (blockId→taskId), `taskBlockIndex` (taskId→blockId), `dueIndex` (date→taskIds)
- GlobalFilter applied at load time to exclude tasks matching filter patterns
- Block attributes sync to SiYuan DOM for visual integration (`BLOCK_ATTR_TASK_ID`, `BLOCK_ATTR_TASK_DUE`, etc.)

### Event-Driven Recurrence Engine
**Scheduler** ([src/core/engine/Scheduler.ts](src/core/engine/Scheduler.ts)):
- Emits semantic events: `task:due`, `task:overdue` (not side effects)
- EventService (in [src/services/EventService.ts](src/services/EventService.ts)) owns NotificationState and reactions
- RecurrenceEngineRRULE uses rrule library for complex recurrence patterns
- OnCompletionHandler determines next occurrence after task completion
- Forward progress validation prevents infinite loops in recurrence calculation

### Inline Task System
**Parsing** ([src/parser/InlineTaskParser.ts](src/parser/InlineTaskParser.ts)):
- Emoji-based metadata: 📅 due date, 🔁 recurrence, 🔺🔼🔽 priority, 🆔 ID, ⛔ dependencies, # tags
- Natural language dates via chrono-node: "tomorrow at 3pm", "next Friday", "in 2 days"
- Bidirectional: markdown ↔ ParsedTask
- Toggle handler ([src/commands/InlineToggleHandler.ts](src/commands/InlineToggleHandler.ts)) with debouncing (100ms) processes checkbox state changes

### AI Suggestions (Rule-Based, No External APIs)
**SmartSuggestionEngine** ([src/core/ai/SmartSuggestionEngine.ts](src/core/ai/SmartSuggestionEngine.ts)):
- Abandonment: Task never completed in 5+ misses OR completion rate < 10%
- Reschedule: Analyzes completion hour patterns from `completionContexts` (confidence ≥ 70%, ≥ 2hr difference)
- Urgency: 3+ consecutive misses → suggest high priority
- Frequency optimization: Completion rate > 1.5× scheduled → increase frequency
- All deterministic logic, no ML model loading

## Development Workflow

### Build & Dev Setup
```bash
npm run dev           # Vite watch mode - builds to dist/
npm run build         # Production build
npm run test          # Vitest unit tests
npm run make-link     # Symlink dist/ to SiYuan workspace
```

**make-link script** ([scripts/make_dev_link.js](scripts/make_dev_link.js)):
- Creates symlink: `<workspace>/data/plugins/<plugin-name>` → `dist/`
- Use `--workspace=<path>` or env vars `SIYUAN_WORKSPACE` / `SHEHAB_NOTE_WORKSPACE`
- Enables hot reload during development

### Path Aliases
tsconfig.json defines `@/*` → `./src/*`. Always use `@/` for internal imports:
```typescript
import { TaskManager } from "@/core/managers/TaskManager";
import type { Task } from "@/core/models/Task";
```

### Testing Strategy
- Unit tests: Vitest with jsdom environment ([vitest.config.ts](vitest.config.ts))
- Test patterns in `src/**/*.test.ts`, `tests/**/*.test.ts`
- SiYuan API stubbed via [src/__tests__/siyuan-stub.ts](src/__tests__/siyuan-stub.ts)
- 59+ tests for adapters, validators, dashboard components (see AI_AGENT_CODING_PROMPT.md)

## Critical Implementation Details

### Task Model Schema ([src/core/models/Task.ts](src/core/models/Task.ts))
- Always validate `enabled` flag before scheduling
- Track analytics: `completionCount`, `missCount`, `currentStreak`, `recentCompletions` (capped at MAX_RECENT_COMPLETIONS)
- `version` field for schema migrations (current: CURRENT_SCHEMA_VERSION)
- Block actions: `blockActions[]` - trigger-action pairs for SiYuan block events
- Dependencies: `dependsOn[]` task IDs - validate no circular deps

### Recurrence Forward Progress
**RecurrenceCalculator** ([src/recurrence/RecurrenceCalculator.ts](src/recurrence/RecurrenceCalculator.ts)):
- MUST throw `RECURRENCE_NO_PROGRESS` if next occurrence ≤ base date
- Iteration limit: 1000 (configurable via MAX_RECOVERY_ITERATIONS)
- Always validate `interval !== 0` for interval patterns
- Horizon check prevents infinite future scheduling

### Webhook Integration
**OutboundWebhookEmitter** ([src/events/OutboundWebhookEmitter.ts](src/events/OutboundWebhookEmitter.ts)):
- Fire-and-forget event emission with retry queue
- Signature generation for webhook security (SignatureGenerator)
- Supports n8n, Telegram Bot API, Gmail API via configurable channels
- EventQueue handles async delivery + RetryManager for failed sends

## Common Gotchas

1. **Never bypass TaskManager initialization order** - Settings must load before Storage
2. **Check `task.enabled` before all operations** - disabled tasks shouldn't emit events
3. **Use RecurrenceEngine for all date calculations** - don't manually compute next occurrence
4. **Debounce DOM interactions** - InlineToggleHandler debounces at 100ms to prevent rapid toggles
5. **Filter awareness** - GlobalFilter.getInstance() applied at storage load; changes require reload
6. **Block sync failures** - TaskStorage has retry queue for failed SiYuan block attribute syncs
7. **Timezone handling** - TimezoneHandler in Scheduler normalizes dates; respect task.timezone field

## SiYuan Plugin API Integration
- Plugin lifecycle: `onload()` → initialize services → register UI → start TaskManager
- Dock API: Register persistent sidebar with `addDock()` (see [src/index.ts](src/index.ts))
- Block attributes: Use `BLOCK_ATTR_*` constants when syncing to DOM
- fetchPost: Use SiYuan's `fetchPost()` for all API calls (avoid direct HTTP)

## Current Development Status
Per AI_AGENT_CODING_PROMPT.md, primary objective is completing TaskEditorModal with:
- 10 sections: Basic info → Priority → Status → Dates → Recurrence → Dependencies → Tags → Block Actions → AI Suggestions → Buttons
- Validation: start ≤ scheduled ≤ due dates
- Recurrence preview: next 5 occurrences
- Dependency picker with circular dependency prevention
- All 6 AI suggestion features integrated with user approval flow
