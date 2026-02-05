# File Mapping & Migration Checklist

**Date:** February 5, 2026  
**Purpose:** Step-by-step file movement/deletion guide

---

## 🔴 PHASE 1: CRITICAL DELETIONS (Fix Duplicates)

### Task: Delete Duplicate Files

| # | Action | File Path | Reason | Replace With |
|---|--------|-----------|--------|--------------|
| 1.1 | ❌ DELETE | `src/shared/utils/task/Task.ts` | Duplicate of core model | `src/backend/core/models/Task.ts` |
| 1.2 | ❌ DELETE | `src/shared/utils/dateTime/DateParser.ts` | Duplicate parser | `src/backend/core/parsers/DateParser.ts` |
| 1.3 | ❌ DELETE | `src/shared/utils/misc/DateParser.ts` | Wrapper around duplicate | `src/backend/core/parsers/DateParser.ts` |
| 1.4 | ❌ DELETE | `src/shared/utils/misc/RecurrenceParser.ts` | Duplicate parser | `src/backend/core/parsers/RecurrenceParser.ts` |
| 1.5 | ❌ DELETE | `src/shared/utils/misc/timezone.ts` | Duplicate | `src/backend/core/engine/TimezoneHandler.ts` (already exists) |
| 1.6 | ❌ DELETE | `src/frontend/components/task/` | Empty directory | N/A |

**Import Updates Required:** ~150-200 files (use automated script)

---

## 🟡 PHASE 2: BACKEND CONSOLIDATION

### Task: Merge Single-File Folders into Services

| # | Action | Source | Destination | New Name |
|---|--------|--------|-------------|----------|
| 2.1 | 🔀 MOVE+RENAME | `src/backend/auth/ApiKeyManager.ts` | `src/backend/services/` | `AuthService.ts` |
| 2.2 | 🔀 MERGE | `src/backend/bulk/*.ts` (3 files) | `src/backend/services/` | `BulkService.ts` (merge logic) |
| 2.3 | 🔀 MOVE | `src/backend/adapters/TaskModelAdapter.ts` | `src/backend/services/` | `TaskAdapterService.ts` |
| 2.4 | 🔀 MOVE | `src/backend/core/settings/SettingsService.ts` | `src/backend/services/` | (Keep name) |

**Post-Move:** Delete empty directories (`auth/`, `bulk/`, `adapters/`)

---

### Task: Consolidate Recurrence Logic

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 2.5 | 🔀 MOVE | `src/backend/recurrence/RecurrenceCalculator.ts` | `src/backend/core/engine/recurrence/` |
| 2.6 | 🔀 MOVE | `src/backend/recurrence/RecurrencePreview.ts` | `src/backend/core/engine/recurrence/` |

**Post-Move:** Delete `src/backend/recurrence/` directory

---

### Task: Extract Block Logic from Commands

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 2.7 | 🔀 MOVE | `src/backend/commands/BlockHandler.ts` | `src/backend/blocks/` |
| 2.8 | 🔀 MOVE | `src/backend/commands/BlockNormalizer.ts` | `src/backend/blocks/` |
| 2.9 | 🔀 MOVE | `src/backend/commands/CreateTaskFromBlock.ts` | `src/backend/blocks/` |
| 2.10 | 🔀 MOVE | `src/backend/core/block-actions/*` | `src/backend/blocks/` |

**Create:** New `src/backend/blocks/` directory

---

### Task: Reorganize Webhooks

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 2.11 | 🔀 MOVE | `src/backend/webhooks/*` | `src/backend/webhooks/inbound/` |
| 2.12 | 🔀 MOVE | `src/backend/events/OutboundWebhookEmitter.ts` | `src/backend/webhooks/outbound/` |
| 2.13 | 🔀 MOVE | `src/backend/events/RetryManager.ts` | `src/backend/webhooks/outbound/` |
| 2.14 | 🔀 MOVE | `src/backend/events/SignatureGenerator.ts` | `src/backend/webhooks/outbound/` |
| 2.15 | 🔀 MOVE | `src/backend/events/EventQueue.ts` | `src/backend/webhooks/outbound/` |

**Folder Structure After:**
```
webhooks/
├── inbound/
│   ├── middleware/
│   ├── Router.ts
│   └── WebhookServer.ts
├── outbound/
│   ├── OutboundWebhookEmitter.ts
│   ├── RetryManager.ts
│   ├── SignatureGenerator.ts
│   └── EventQueue.ts
└── types/
```

---

### Task: Consolidate Parsers

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 2.16 | 🔀 MOVE | `src/backend/parsers/InlineTaskParser.ts` | `src/backend/core/parsers/` |
| 2.17 | 🔀 MOVE | `src/backend/parsers/InlineTaskParser.test.ts` | `src/backend/core/parsers/` |
| 2.18 | 🔀 MOVE | `src/backend/parsers/InlineTaskParser.performance.test.ts` | `src/backend/core/parsers/` |

**Post-Move:** Delete `src/backend/parsers/` directory

---

### Task: Simplify Commands Structure

| # | Action | Source | Destination/New Name |
|---|--------|--------|---------------------|
| 2.19 | 🔄 RENAME | `src/backend/commands/CommandRegistry.ts` | `src/backend/commands/registry.ts` |
| 2.20 | 🔀 MOVE | `src/backend/commands/validation/TaskValidator.ts` | `src/backend/commands/validator.ts` |
| 2.21 | 🔀 MERGE | `src/backend/commands/types/*.ts` (3 files) | `src/backend/commands/types.ts` |

**Post-Move:** Delete `validation/` directory

---

## 🎨 PHASE 3: FRONTEND REORGANIZATION

### Task: Move Business Logic to Backend

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 3.1 | 🔀 MOVE | `src/frontend/components/reminders/model/*` | `src/backend/integrations/reminders/` |
| 3.2 | 🔀 MOVE | `src/frontend/components/reminders/plugin/filesystem.ts` | `src/backend/integrations/reminders/` |
| 3.3 | 🔀 MOVE | `src/frontend/components/reminders/plugin/data.ts` | `src/backend/integrations/reminders/` |
| 3.4 | 🔀 MOVE | `src/frontend/components/reminders/plugin/commands/*` | `src/backend/integrations/reminders/commands/` |

**Keep in Frontend:** Only `reminders/ui/*` and `reminders/plugin/ui/*`

---

### Task: Flatten Analytics Structure

| # | Action | Source Pattern | Destination |
|---|--------|----------------|-------------|
| 3.5 | 🔀 MOVE | `src/frontend/components/analytics/core/components/analytics/*` | `src/frontend/components/analytics/` (flatten) |
| 3.6 | ❌ DELETE | `src/frontend/components/analytics/projects/[workspaceSlug]/` | Flatten into analytics/ |

**Result:** Max 2 levels deep instead of 5+

---

### Task: Fix Calendar Typo

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 3.7 | 🔄 RENAME | `src/frontend/components/calendar/ui-calandar/` | `src/frontend/components/calendar/ui/` |

---

### Task: Organize Common Components

Create subdirectories in `common/`:

| # | Action | Files | New Location |
|---|--------|-------|--------------|
| 3.8 | 🔀 GROUP | `DateEditor.svelte`, `PriorityEditor.svelte`, `RecurrenceEditor.svelte`, `StatusEditor.svelte`, `TagsCategoryEditor.svelte`, `BlockActionsEditor.svelte` | `common/editors/` |
| 3.9 | 🔀 GROUP | `EditTask.svelte`, `EditableTask.ts`, `Dependency.svelte`, `EditTaskHelpers.ts` → `helpers.ts` | `common/task/` |
| 3.10 | 🔀 GROUP | `AISuggestionsPanel.svelte`, `RecurrencePreview.svelte`, `TrackerDashboard.svelte` | `common/panels/` |
| 3.11 | 🔀 GROUP | `Menus/*` | `common/menus/` (already correct) |

---

### Task: Rename Stores to Kebab-Case

| # | Action | Old Name | New Name |
|---|--------|----------|----------|
| 3.12 | 🔄 RENAME | `taskOrderStore.ts` | `task-order.store.ts` |
| 3.13 | 🔄 RENAME | `taskAnalyticsStore.ts` | `task-analytics.store.ts` |
| 3.14 | 🔄 RENAME | `searchStore.ts` | `search.store.ts` |
| 3.15 | 🔄 RENAME | `keyboardShortcutsStore.ts` | `keyboard-shortcuts.store.ts` |
| 3.16 | 🔄 RENAME | `i18nStore.ts` | `i18n.store.ts` |
| 3.17 | 🔄 RENAME | `bulkSelectionStore.ts` | `bulk-selection.store.ts` |

---

## 📦 PHASE 4: SHARED REORGANIZATION

### Task: Move UI Utils to Frontend

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 4.1 | 🔀 MOVE | `src/shared/utils/misc/notifications.ts` | `src/frontend/utils/notifications.ts` |
| 4.2 | 🔀 MOVE | `src/shared/utils/misc/keyboardHandler.ts` | `src/frontend/utils/keyboard.ts` |
| 4.3 | 🔀 MOVE | `src/shared/utils/misc/bulkOperations.ts` | `src/frontend/utils/bulk-operations.ts` |
| 4.4 | 🔀 MOVE | `src/shared/utils/misc/reorderTasks.ts` | `src/frontend/utils/reorder-tasks.ts` |

---

### Task: Move Backend Utils to Backend

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 4.5 | 🔀 MOVE | `src/shared/utils/misc/logger.ts` | `src/backend/logging/logger.ts` |
| 4.6 | ❌ DELETE | `src/shared/utils/misc/timezone.ts` | Use `backend/core/engine/TimezoneHandler.ts` |
| 4.7 | 🔀 MOVE | `src/shared/utils/misc/PerformanceProfiler.ts` | `src/backend/logging/performance.ts` |

---

### Task: Reorganize Shared Utils

| # | Action | Source | Destination |
|---|--------|--------|-------------|
| 4.8 | 🔀 MERGE | `src/shared/utils/dateTime/*` + date-related from `misc/` | `src/shared/utils/date/` |
| 4.9 | 🔀 MOVE | `src/shared/utils/lib/StringHelpers.ts` | `src/shared/utils/string/` |
| 4.10 | 🔀 MOVE | `src/shared/utils/lib/HTMLCharacterEntities.ts` | `src/shared/utils/string/` |
| 4.11 | 🔀 MOVE | `src/shared/utils/lib/MarkdownTable.ts` | `src/shared/utils/formatting/` |

---

### Task: Rename for Consistency

| # | Action | Old Name | New Name |
|---|--------|----------|----------|
| 4.12 | 🔄 RENAME | `fuzzySearch.ts` | `fuzzy-search.ts` |
| 4.13 | 🔄 RENAME | `PlaceholderResolver.ts` | `placeholders.ts` |
| 4.14 | 🔄 RENAME | `taskTemplates.ts` | `task-templates.ts` |
| 4.15 | 🔄 RENAME | `SettingUtils.ts` | `setting-utils.ts` |

---

### Task: Create Types Directory

| # | Action | What | Where |
|---|--------|------|------|
| 4.16 | 📁 CREATE | `src/shared/types/` directory | N/A |
| 4.17 | 📝 CREATE | Extract common types | `src/shared/types/task.types.ts` |
| 4.18 | 📝 CREATE | Extract recurrence types | `src/shared/types/recurrence.types.ts` |
| 4.19 | 📝 CREATE | Extract webhook types | `src/shared/types/webhook.types.ts` |
| 4.20 | 📝 CREATE | Barrel export | `src/shared/types/index.ts` |

---

## 🔧 PHASE 5: IMPORT PATH UPDATES

### Automated Script Execution

| # | Tool | Command | Purpose |
|---|------|---------|---------|
| 5.1 | Script | `node scripts/dev/fix-relative-imports.cjs` | Convert relative to absolute imports |
| 5.2 | Script | `node scripts/dev/update-imports.cjs` | Update paths after moves |
| 5.3 | Manual | Search & Replace | Fix remaining broken imports |

### Manual Import Fixes (Estimate)

| File Type | Estimated Count | Fix Method |
|-----------|----------------|------------|
| Task imports | ~80 files | Automated |
| DateParser imports | ~30 files | Automated |
| RecurrenceParser imports | ~20 files | Automated |
| Store imports | ~40 files | Automated |
| Other moves | ~50 files | Semi-automated |

**Total Affected Files:** ~220

---

## ✅ PHASE 6: VERIFICATION

### Build Checks

| # | Check | Command | Must Pass |
|---|-------|---------|-----------|
| 6.1 | TypeScript Compilation | `npm run build` | ✅ Yes |
| 6.2 | Unit Tests | `npm test` | ✅ Yes |
| 6.3 | Linting | `npm run lint` (if exists) | ✅ Yes |
| 6.4 | Import Validation | `tsc --noEmit` | ✅ Yes |

### Manual Verification

| # | Verification | How |
|---|--------------|-----|
| 6.5 | No duplicate exports | Search for duplicate symbol names |
| 6.6 | No empty folders | Run `find . -type d -empty` |
| 6.7 | Circular dependencies | Use `madge` or similar tool |
| 6.8 | Unused files | Use `ts-prune` or similar |

---

## 📊 PROGRESS TRACKING

### Phase Completion

| Phase | Tasks | Completed | % Done | Status |
|-------|-------|-----------|--------|--------|
| Phase 1: Critical Deletions | 6 | 0 | 0% | ⏳ Pending |
| Phase 2: Backend Consolidation | 21 | 0 | 0% | ⏳ Pending |
| Phase 3: Frontend Reorganization | 17 | 0 | 0% | ⏳ Pending |
| Phase 4: Shared Reorganization | 20 | 0 | 0% | ⏳ Pending |
| Phase 5: Import Path Updates | 3 | 0 | 0% | ⏳ Pending |
| Phase 6: Verification | 9 | 0 | 0% | ⏳ Pending |
| **TOTAL** | **76** | **0** | **0%** | ⏳ Not Started |

---

## 🎯 IMPLEMENTATION ORDER

### Recommended Sequence

1. **START:** Phase 1 (Critical Deletions)
   - ⚠️ Creates breaking changes immediately
   - ✅ Exposes issues early
   - ✅ Prevents working on wrong code

2. **THEN:** Phase 2 (Backend Consolidation)
   - ✅ Backend is more stable (fewer external dependencies)
   - ✅ Services consolidation simplifies structure

3. **THEN:** Phase 4 (Shared Reorganization)
   - ✅ Affects both frontend and backend
   - ✅ Must be done before frontend finalization

4. **THEN:** Phase 3 (Frontend Reorganization)
   - ✅ Most dependencies on backend/shared
   - ✅ Easier after backend stabilizes

5. **THEN:** Phase 5 (Import Updates)
   - ✅ Fix everything at once
   - ✅ Run automated scripts

6. **FINALLY:** Phase 6 (Verification)
   - ✅ Ensure nothing broken
   - ✅ Run full test suite

---

## 🚨 ROLLBACK PLAN

### If Something Breaks

| Issue | Rollback Method |
|-------|----------------|
| Build fails | `git reset --hard <commit-before-phase>` |
| Tests fail | Revert specific phase commits |
| Import chaos | Re-run import fixer script |
| Lost files | Check git history: `git log --all --full-history -- "path/to/file"` |

### Recommended Git Strategy

```bash
# Before each phase
git checkout -b refactor/phase-N

# After each successful phase
git commit -m "refactor: Complete Phase N - <description>"
git checkout main
git merge refactor/phase-N

# If phase fails
git checkout main
git branch -D refactor/phase-N
```

---

## 📝 NOTES

- **Do NOT skip Phase 1** - Duplicates will cause confusion throughout
- **Test after EACH phase** - Don't accumulate errors
- **Use `git mv`** for moves/renames - Preserves history
- **Commit frequently** - Small commits = easier debugging
- **Update this checklist** - Mark completed items as you go

---

**Total Time Estimate:** 8-12 hours (with automated tools)  
**Risk Level:** Medium (breaking changes, but reversible with git)  
**Reward:** Clean, maintainable codebase ✨

---

**END OF MAPPING**
