# Codebase Analysis Report
Generated: 2026-02-14T08:18:15.143Z

## Statistics

- **Total Files**: 576
- **Total Lines of Code**: 124,843
- **Backend Files**: 265
- **Frontend Files**: 216
- **Shared Files**: 63
- **Domain Files**: 13

## Orphan Files (Not Imported)

Found 288 orphan files:

- `src/application/actions/CompletionHandler.ts`
- `src/assets/icons/index.ts`
- `src/backend/adapters/index.ts`
- `src/backend/analytics/AnalyticsReporter.ts`
- `src/backend/blocks/blocks.ts`
- `src/backend/blocks/bulk-operations.ts`
- `src/backend/blocks/index.ts`
- `src/backend/bulk/index.ts`
- `src/backend/commands/CreateTaskFromBlock.ts`
- `src/backend/commands/handlers/EventCommandHandler.ts`
- `src/backend/commands/index.ts`
- `src/backend/commands/InlineToggleHandler.ts`
- `src/backend/commands/types/BulkCommandHandler.ts`
- `src/backend/core/actions/DeleteHandler.ts`
- `src/backend/core/ai/learning/ModelTuner.ts`
- `src/backend/core/block-actions/BlockEventWatcher.ts`
- `src/backend/core/cache/Cache.ts`
- `src/backend/core/cache/index.ts`
- `src/backend/core/cache/TasksEvents.ts`
- `src/backend/core/dependencies/CrossNoteDependencyChecker.ts`
- `src/backend/core/engine/DependencyGraph.ts`
- `src/backend/core/engine/recurrence/index.ts`
- `src/backend/core/engine/recurrence/RecurrenceTaskAdapter.ts`
- `src/backend/core/file/index.ts`
- `src/backend/core/filtering/GlobalFilterEngine.ts`
- `src/backend/core/indexing/TaskIndexManager.ts`
- `src/backend/core/inline-query/index.ts`
- `src/backend/core/inline-query/InlineQueryController.ts`
- `src/backend/core/managers/index.ts`
- `src/backend/core/models/RecurrencePatterns.ts`
- `src/backend/core/navigation/CommandPalette.ts`
- `src/backend/core/navigation/keybindings.ts`
- `src/backend/core/navigation/KeyboardNavigationController.ts`
- `src/backend/core/parsers/NaturalLanguageParser.ts`
- `src/backend/core/parsers/TaskLineParser.ts`
- `src/backend/core/parsers/TaskLineSerializer.ts`
- `src/backend/core/query/ExplanationCache.ts`
- `src/backend/core/query/index.ts`
- `src/backend/core/query/PresetManager.ts`
- `src/backend/core/reminders/format/index.ts`
- `src/backend/core/rendering/index.ts`
- `src/backend/core/rendering/InlineRenderer.ts`
- `src/backend/core/rendering/LivePreviewExtension.ts`
- `src/backend/core/scheduling/DualEngineScheduler.ts`
- `src/backend/core/settings/FeatureFlags.ts`
- `src/backend/core/storage/MigrationManager.ts`
- `src/backend/core/sync/BlockAttributeBatchSync.ts`
- `src/backend/core/ui/TaskUIState.ts`
- `src/backend/features/AutoTaskCreator.ts`
- `src/backend/integrations/reminders/commands/index.ts`
- ... and 238 more

## Duplicate File Name Candidates

Found 37 files with duplicate names:

### CompletionHandler
- `src/application/actions/CompletionHandler.ts`
- `src/backend/core/actions/CompletionHandler.ts`

### index
- `src/assets/icons/index.ts`
- `src/backend/adapters/index.ts`
- `src/backend/blocks/index.ts`
- `src/backend/bulk/index.ts`
- `src/backend/commands/index.ts`
- `src/backend/core/cache/index.ts`
- `src/backend/core/engine/recurrence/index.ts`
- `src/backend/core/file/index.ts`
- `src/backend/core/index.ts`
- `src/backend/core/inline-query/index.ts`
- `src/backend/core/managers/index.ts`
- `src/backend/core/query/index.ts`
- `src/backend/core/reminders/format/index.ts`
- `src/backend/core/rendering/index.ts`
- `src/backend/index.ts`
- `src/backend/integrations/reminders/commands/index.ts`
- `src/backend/integrations/reminders/index.ts`
- `src/backend/integrations/reminders/settings/index.ts`
- `src/backend/integrations/reminders/ui/index.ts`
- `src/backend/parsers/index.ts`
- `src/backend/services/index.ts`
- `src/backend/webhooks/index.ts`
- `src/frontend/components/analytics/index.ts`
- `src/frontend/components/analytics/insight-table/index.ts`
- `src/frontend/components/analytics/overview/index.ts`
- `src/frontend/components/analytics/work-items/index.ts`
- `src/frontend/components/analytics/work-items/modal/index.ts`
- `src/frontend/components/calendar/index.ts`
- `src/frontend/components/calendar/ui/sources/index.ts`
- `src/frontend/components/dashboard/index.ts`
- `src/frontend/components/index.ts`
- `src/frontend/components/query/index.ts`
- `src/frontend/components/reminders/index.ts`
- `src/frontend/components/settings/index.ts`
- `src/frontend/components/shared/index.ts`
- `src/frontend/components/tasks/index.ts`
- `src/frontend/index.ts`
- `src/frontend/modals/index.ts`
- `src/frontend/stores/index.ts`
- `src/index.ts`
- `src/shared/assets/icons/index.ts`
- `src/shared/config/index.ts`
- `src/shared/constants/index.ts`
- `src/shared/index.ts`
- `src/shared/utils/compat/index.ts`
- `src/shared/utils/date/index.ts`
- `src/shared/utils/index.ts`
- `src/shared/utils/lib/index.ts`
- `src/shared/utils/task/index.ts`

### BulkCommandHandler
- `src/backend/commands/handlers/BulkCommandHandler.ts`
- `src/backend/commands/types/BulkCommandHandler.ts`

### WebhookConfig
- `src/backend/config/WebhookConfig.ts`
- `src/shared/config/WebhookConfig.ts`

### DependencyGraph
- `src/backend/core/dependencies/DependencyGraph.ts`
- `src/backend/core/engine/DependencyGraph.ts`
- `src/domain/dependencies/DependencyGraph.ts`

### RecurrenceEngine
- `src/backend/core/engine/recurrence/RecurrenceEngine.ts`
- `src/backend/core/recurrence/RecurrenceEngine.ts`
- `src/backend/services/RecurrenceEngine.ts`
- `src/domain/recurrence/RecurrenceEngine.ts`

### utils
- `src/backend/core/engine/recurrence/utils.ts`
- `src/frontend/components/analytics/work-items/utils.ts`
- `src/frontend/components/calendar/ui/utils.ts`

### GlobalFilter
- `src/backend/core/filtering/GlobalFilter.ts`
- `src/shared/config/GlobalFilter.ts`

### TaskIndexManager
- `src/backend/core/indexing/TaskIndexManager.ts`
- `src/backend/core/storage/TaskIndexManager.ts`

### Status
- `src/backend/core/models/Status.ts`
- `src/shared/constants/statuses/Status.ts`
- `src/shared/types/Status.ts`

### StatusRegistry
- `src/backend/core/models/StatusRegistry.ts`
- `src/shared/constants/statuses/StatusRegistry.ts`
- `src/shared/types/StatusRegistry.ts`

### Task
- `src/backend/core/models/Task.ts`
- `src/backend/Task/Task.ts`
- `src/domain/models/Task.ts`
- `src/frontend/components/shared/Task/Task.ts`
- `src/shared/utils/task/Task.ts`

### TaskLineParser
- `src/backend/core/parsers/TaskLineParser.ts`
- `src/infrastructure/parsers/TaskLineParser.ts`

### TaskLineSerializer
- `src/backend/core/parsers/TaskLineSerializer.ts`
- `src/infrastructure/parsers/TaskLineSerializer.ts`

### QueryParser
- `src/backend/core/query/QueryParser.ts`
- `src/domain/query/QueryParser.ts`

### content
- `src/backend/core/reminders/content.ts`
- `src/frontend/components/analytics/work-items/modal/content.ts`

### util
- `src/backend/core/reminders/format/util.ts`
- `src/backend/integrations/reminders/ui/util.ts`

### reminder
- `src/backend/core/reminders/reminder.ts`
- `src/backend/integrations/reminders/ui/reminder.ts`

### TaskIndex
- `src/backend/core/storage/TaskIndex.ts`
- `src/domain/index/TaskIndex.ts`

### constants
- `src/backend/integrations/reminders/ui/constants.ts`
- `src/constants.ts`
- `src/frontend/components/calendar/constants.ts`


## Broken Imports

Found 45 broken imports:

- **src/backend/core/reminders/content.ts:1** - Cannot resolve `@backend/core/reminders/format`
- **src/backend/core/reminders/content.ts:2** - Cannot resolve `@backend/core/reminders/format`
- **src/backend/integrations/reminders/commands/show-date-chooser.ts:2** - Cannot resolve `@backend/integrations/reminders/ui`
- **src/backend/integrations/reminders/commands/show-reminder-list.ts:1** - Cannot resolve `@backend/integrations/reminders/ui`
- **src/backend/integrations/reminders/data.ts:6** - Cannot resolve `@backend/integrations/reminders/settings`
- **src/backend/integrations/reminders/settings/helper.ts:6** - Cannot resolve `@backend/core/reminders/format`
- **src/backend/integrations/reminders/settings/index.ts:1** - Cannot resolve `@backend/core/reminders/format`
- **src/backend/integrations/reminders/ui/autocomplete.ts:6** - Cannot resolve `@backend/core/reminders/format`
- **src/backend/integrations/reminders/ui/editor-extension.ts:6** - Cannot resolve `@backend/integrations/reminders/settings`
- **src/backend/integrations/reminders/ui/index.ts:14** - Cannot resolve `@backend/integrations/reminders/commands`
- **src/backend/services/TaskAdapterService.ts:16** - Cannot resolve `@shared/utils/task/priority`
- **src/backend/services/TaskAdapterService.ts:18** - Cannot resolve `@shared/utils/task/recurrence`
- **src/frontend/components/analytics/select/analytics-params.ts:3** - Cannot resolve `@components/analytics/select/select-y-axis`
- **src/frontend/components/calendar/io/dailyNotes.ts:8** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/io/weeklyNotes.ts:8** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/settings.ts:6** - Cannot resolve `src/constants`
- **src/frontend/components/calendar/testUtils/settings.ts:1** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/ui/Calendar.svelte:12** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/ui/sources/wordCount.ts:8** - Cannot resolve `src/constants`
- **src/frontend/components/calendar/ui/stores.ts:9** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/view.ts:13** - Cannot resolve `src/constants`
- **src/frontend/components/calendar/view.ts:16** - Cannot resolve `src/settings`
- **src/frontend/components/calendar/view.ts:21** - Cannot resolve `@components/calendar/ui/sources`
- **src/frontend/components/reminders/main.ts:2** - Cannot resolve `@backend/integrations/reminders`
- **src/frontend/components/reminders/ui/Calendar.svelte:4** - Cannot resolve `@backend/integrations/reminders/settings`
- **src/frontend/components/reminders/ui/DateTimeChooser.svelte:8** - Cannot resolve `@stores/i18n.store`
- **src/frontend/components/reminders/ui/Reminder.svelte:7** - Cannot resolve `@stores/i18n.store`
- **src/frontend/components/shared/AISuggestionsPanel.svelte:13** - Cannot resolve `@stores/i18n.store`
- **src/frontend/components/shared/Dependency.svelte:7** - Cannot resolve `@stores/i18n.store`
- **src/frontend/components/shared/editors/BlockActionsEditor.svelte:14** - Cannot resolve `@stores/i18n.store`
- ... and 15 more

## Frontend-Backend Connections

Found 0 frontend files importing from backend/core:

