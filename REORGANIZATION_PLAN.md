# Project Reorganization Plan

**Generated:** 2026-02-05  
**Project:** SiYuan Task Management Plugin

---

## 1. Current Issues Identified

### 1.1 Root Directory Pollution
- 10+ markdown files at root that belong in `/docs`
- Utility/debug scripts scattered at root level
- Build artifacts mixed with source files

### 1.2 Naming Inconsistencies
| Issue | Examples |
|-------|----------|
| Mixed case in scripts | `make_dev_link.js` vs `generate-icons.js` |
| Version suffixes in docs | `bulk-performance_Version3`, `recurrence-edge-cases_Version2` |
| Mixed doc naming | `AI_FEATURES.md` vs `migration-guide.md` |

### 1.3 Documentation Scattered
- Root-level docs should be in `/docs/internal/`
- No clear categorization (user guides vs developer docs)

---

## 2. Proposed New Structure

```
task-recurring-notification-management/     # ← Renamed root (kebab-case)
├── .git/
├── .github/
│   └── copilot-instructions.md
├── .gitignore
│
├── config/                                  # ← NEW: All configuration files
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── vitest.config.ts
│
├── docs/                                    # Reorganized documentation
│   ├── api/                                 # API & HTTP examples
│   │   └── http-examples/
│   │       ├── bulk-operations.http
│   │       └── task-commands.http
│   │
│   ├── guides/                              # User-facing guides
│   │   ├── getting-started.md              # (was README.md content)
│   │   ├── keyboard-shortcuts.md           # (was keyboard-shortcuts-reference.md)
│   │   ├── mobile-usage.md                 # (was mobile.md)
│   │   ├── migration.md                    # (was migration-guide.md)
│   │   ├── presets.md
│   │   ├── query-examples.md
│   │   ├── query-language.md               # Merged QUERY_LANGUAGE.md + query-language.md
│   │   ├── recurrence.md                   # (was RECURRENCE_GUIDE.md)
│   │   ├── settings.md                     # (was settings-guide.md)
│   │   ├── split-view.md                   # Merged split-view-*.md
│   │   └── task-format.md                  # (was task-format-reference.md)
│   │
│   ├── features/                            # Feature documentation
│   │   ├── ai-suggestions.md               # (was AI_FEATURES.md)
│   │   ├── auto-creation.md                # (was AUTO_CREATION.md)
│   │   ├── bulk-operations.md              # (was bulk-performance_Version3)
│   │   ├── global-filter.md                # (was global-filter-query.md)
│   │   ├── inline-task-parser.md           # Merged InlineTaskParser-Examples + InlineTaskSyntax
│   │   ├── natural-language-dates.md       # Merged natural-language + NATURAL_LANGUAGE_DATES
│   │   ├── outbound-webhooks.md            # (was outbound-webhooks_Version2.md)
│   │   └── recurrence-edge-cases.md        # (was recurrence-edge-cases_Version2)
│   │
│   ├── architecture/                        # Developer/internal docs
│   │   ├── icon-system.md                  # (was ICON_SYSTEM.md)
│   │   ├── optimistic-updates.md           # (was OPTIMISTIC_UPDATE_GUIDE.md)
│   │   ├── phase3-features.md              # (was PHASE3_FEATURES.md)
│   │   ├── phase4-user-guide.md            # (was PHASE4_USER_GUIDE.md)
│   │   ├── rrule-engine.md                 # (was RRULE_ENGINE_IMPLEMENTATION.md)
│   │   └── shortcuts-implementation.md     # (was SHORTCUTS.md)
│   │
│   └── internal/                            # ← NEW: Development reports (from root)
│       ├── ai-agent-coding-prompt.md       # (was AI_AGENT_CODING_PROMPT.md)
│       ├── backend-audit-report.md         # (was BACKEND_AUDIT_REPORT.md)
│       ├── backend-fixes-summary.md        # (was BACKEND_FIXES_SUMMARY.md)
│       ├── frontend-audit-report.md        # (was FRONTEND_AUDIT_REPORT.md)
│       ├── frontend-refactoring-plan.md    # (was FRONTEND_REFACTORING_PLAN.md)
│       ├── icon-implementation-summary.md  # (was ICON_IMPLEMENTATION_SUMMARY.md)
│       ├── implementation-summary.md       # (was IMPLEMENTATION_SUMMARY.md)
│       ├── integration-test-checklist.md   # (was INTEGRATION_TEST_CHECKLIST.md)
│       ├── phase1-completion-summary.md    # (was PHASE1_COMPLETION_SUMMARY.md)
│       ├── refactoring-progress.md         # (was REFACTORING_PROGRESS.md)
│       └── refactoring-quick-guide.md      # (was REFACTORING_QUICK_GUIDE.md)
│
├── i18n/
│   └── en_US.json
│
├── scripts/                                 # All build/dev scripts
│   ├── build/
│   │   └── generate-plugin-images.js       # (was generate-plugin-images.js)
│   ├── dev/
│   │   ├── debug-recurrence.js             # (was at root)
│   │   ├── fix-relative-imports.cjs        # (was at root)
│   │   ├── make-dev-link.js                # (was make_dev_link.js - renamed)
│   │   └── update-imports.cjs              # (was at root)
│   └── icons/
│       ├── generate-icons.js
│       └── generate-png-placeholders.js
│
├── src/
│   ├── index.ts
│   │
│   ├── assets/
│   │   └── icons/
│   │       ├── actions/
│   │       ├── features/
│   │       ├── navigation/
│   │       └── status/
│   │
│   ├── backend/
│   │   ├── index.ts
│   │   ├── adapters/
│   │   │   └── task-model-adapter.ts       # (was TaskModelAdapter.ts)
│   │   ├── auth/
│   │   │   └── api-key-manager.ts          # (was ApiKeyManager.ts)
│   │   ├── bulk/
│   │   │   ├── batch-config.ts             # (was BatchConfig.ts)
│   │   │   ├── bulk-executor.ts            # (was BulkExecutor.ts)
│   │   │   └── partial-result-collector.ts # (was PartialResultCollector.ts)
│   │   ├── commands/
│   │   │   ├── block-handler.ts            # (was BlockHandler.ts)
│   │   │   ├── block-normalizer.ts         # (was BlockNormalizer.ts)
│   │   │   ├── command-registry.ts         # (was CommandRegistry.ts)
│   │   │   ├── create-task-from-block.ts   # (was CreateTaskFromBlock.ts)
│   │   │   ├── inline-toggle-handler.ts    # (was InlineToggleHandler.ts)
│   │   │   ├── shortcut-manager.ts         # (was ShortcutManager.ts)
│   │   │   ├── task-commands.ts            # (was TaskCommands.ts)
│   │   │   ├── handlers/
│   │   │   │   ├── base-command-handler.ts
│   │   │   │   ├── bulk-command-handler.ts
│   │   │   │   ├── event-command-handler.ts
│   │   │   │   ├── preview-command-handler.ts
│   │   │   │   ├── query-command-handler.ts
│   │   │   │   ├── recurrence-command-handler.ts
│   │   │   │   ├── search-command-handler.ts
│   │   │   │   └── task-command-handler.ts
│   │   │   ├── types/
│   │   │   └── validation/
│   │   ├── core/
│   │   │   ├── actions/
│   │   │   ├── ai/
│   │   │   ├── analytics/
│   │   │   ├── api/
│   │   │   ├── attention/
│   │   │   ├── block-actions/
│   │   │   ├── cache/
│   │   │   ├── dependencies/
│   │   │   ├── engine/
│   │   │   ├── escalation/
│   │   │   ├── events/
│   │   │   ├── file/
│   │   │   ├── filtering/
│   │   │   ├── inline-query/
│   │   │   ├── integration/
│   │   │   ├── managers/
│   │   │   ├── ml/
│   │   │   ├── models/
│   │   │   │   ├── __tests__/
│   │   │   │   ├── frequency.ts            # (was Frequency.ts)
│   │   │   │   ├── recurrence-patterns.ts  # (was RecurrencePatterns.ts)
│   │   │   │   ├── status.ts               # (was Status.ts)
│   │   │   │   ├── status-registry.ts      # (was StatusRegistry.ts)
│   │   │   │   └── task.ts                 # (was Task.ts)
│   │   │   ├── navigation/
│   │   │   ├── parsers/
│   │   │   ├── query/
│   │   │   ├── rendering/
│   │   │   ├── settings/
│   │   │   ├── storage/
│   │   │   ├── ui/
│   │   │   └── urgency/
│   │   ├── events/
│   │   ├── features/
│   │   ├── logging/
│   │   ├── parsers/
│   │   ├── recurrence/
│   │   ├── services/
│   │   └── webhooks/
│   │
│   ├── frontend/
│   │   ├── index.ts
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── index.ts
│   │   │   ├── analytics/
│   │   │   ├── calendar/
│   │   │   ├── common/
│   │   │   │   ├── menus/                  # (was Menus/)
│   │   │   │   ├── ai-suggestions-panel.svelte
│   │   │   │   ├── block-actions-editor.svelte
│   │   │   │   ├── date-editor.svelte
│   │   │   │   ├── dependency.svelte
│   │   │   │   ├── dependency.scss
│   │   │   │   ├── dependency-helpers.ts
│   │   │   │   ├── editable-task.ts
│   │   │   │   ├── edit-task.svelte
│   │   │   │   ├── edit-task.scss
│   │   │   │   ├── edit-task-helpers.ts
│   │   │   │   ├── edit-task-unified.ts
│   │   │   │   ├── inline-error-hints.ts
│   │   │   │   ├── modal-options-editor.svelte
│   │   │   │   ├── modal-options-editor.scss
│   │   │   │   ├── priority-editor.svelte
│   │   │   │   ├── query.interface.ts      # (was IQuery.ts)
│   │   │   │   ├── recurrence-editor.svelte
│   │   │   │   ├── recurrence-preview.svelte
│   │   │   │   ├── settings-store.ts
│   │   │   │   ├── status-editor.svelte
│   │   │   │   ├── styles.scss
│   │   │   │   ├── tags-category-editor.svelte
│   │   │   │   └── tracker-dashboard.svelte
│   │   │   ├── dashboard/
│   │   │   ├── reminders/
│   │   │   └── task/
│   │   ├── hooks/
│   │   ├── modals/
│   │   │   ├── index.ts
│   │   │   ├── options-modal.ts            # (was OptionsModal.ts)
│   │   │   └── task-modal.ts               # (was TaskModal.ts)
│   │   ├── stores/
│   │   │   ├── index.ts
│   │   │   ├── bulk-selection-store.ts     # (was bulkSelectionStore.ts)
│   │   │   ├── i18n-store.ts               # (was i18nStore.ts)
│   │   │   ├── keyboard-shortcuts-store.ts # (was keyboardShortcutsStore.ts)
│   │   │   ├── search-store.ts             # (was searchStore.ts)
│   │   │   ├── task-analytics-store.ts     # (was taskAnalyticsStore.ts)
│   │   │   └── task-order-store.ts         # (was taskOrderStore.ts)
│   │   ├── styles/
│   │   ├── utils/
│   │   └── views/
│   │
│   └── shared/
│       ├── index.ts
│       ├── assets/
│       ├── config/
│       │   ├── edit-modal-show-settings.ts # (was EditModalShowSettings.ts)
│       │   ├── global-filter.ts            # (was GlobalFilter.ts)
│       │   ├── settings.ts                 # (was Settings.ts)
│       │   ├── status-settings.ts          # (was StatusSettings.ts)
│       │   └── webhook-config.ts           # (was WebhookConfig.ts)
│       ├── constants/
│       │   └── statuses/
│       └── utils/
│           ├── date-time/                  # (was dateTime/)
│           ├── lib/
│           ├── misc/
│           └── task/
│
├── tests/
│   ├── integration/
│   │   ├── bulk-actions.test.ts
│   │   ├── drag-reorder.test.ts
│   │   ├── keyboard-shortcuts.test.ts
│   │   ├── phase3-split-view.test.ts
│   │   ├── search-filters.test.ts
│   │   └── webhook-server.test.ts
│   ├── security/
│   │   └── replay-attack.test.ts
│   └── unit/
│       ├── recurrence-calculator.test.ts
│       ├── signature-generator.test.ts
│       └── validation.test.ts
│
├── dist/                                    # Build output (gitignored)
├── node_modules/                            # Dependencies (gitignored)
│
├── icon.png
├── icon.svg
├── LICENSE
├── package.json
├── package-lock.json
├── plugin.json
├── preview.png
├── preview.svg
└── README.md                                # Keep minimal, link to docs/
```

---

## 3. File Rename Mappings

### 3.1 Root Level → docs/internal/
| Old Path | New Path |
|----------|----------|
| `AI_AGENT_CODING_PROMPT.md` | `docs/internal/ai-agent-coding-prompt.md` |
| `BACKEND_AUDIT_REPORT.md` | `docs/internal/backend-audit-report.md` |
| `BACKEND_FIXES_SUMMARY.md` | `docs/internal/backend-fixes-summary.md` |
| `FRONTEND_AUDIT_REPORT.md` | `docs/internal/frontend-audit-report.md` |
| `FRONTEND_REFACTORING_PLAN.md` | `docs/internal/frontend-refactoring-plan.md` |
| `IMPLEMENTATION_SUMMARY.md` | `docs/internal/implementation-summary.md` |
| `INTEGRATION_TEST_CHECKLIST.md` | `docs/internal/integration-test-checklist.md` |
| `REFACTORING_PROGRESS.md` | `docs/internal/refactoring-progress.md` |
| `REFACTORING_QUICK_GUIDE.md` | `docs/internal/refactoring-quick-guide.md` |

### 3.2 Root Level → config/
| Old Path | New Path |
|----------|----------|
| `tsconfig.json` | `config/tsconfig.json` |
| `vite.config.ts` | `config/vite.config.ts` |
| `vitest.config.ts` | `config/vitest.config.ts` |

### 3.3 Root Level → scripts/dev/
| Old Path | New Path |
|----------|----------|
| `debug-recurrence.js` | `scripts/dev/debug-recurrence.js` |
| `fix-relative-imports.cjs` | `scripts/dev/fix-relative-imports.cjs` |
| `update-imports.cjs` | `scripts/dev/update-imports.cjs` |

### 3.4 Scripts Reorganization
| Old Path | New Path |
|----------|----------|
| `scripts/make_dev_link.js` | `scripts/dev/make-dev-link.js` |
| `scripts/generate-plugin-images.js` | `scripts/build/generate-plugin-images.js` |
| `scripts/generate-icons.js` | `scripts/icons/generate-icons.js` |
| `scripts/generate-png-placeholders.js` | `scripts/icons/generate-png-placeholders.js` |

### 3.5 Docs Reorganization
| Old Path | New Path |
|----------|----------|
| `docs/AI_FEATURES.md` | `docs/features/ai-suggestions.md` |
| `docs/AUTO_CREATION.md` | `docs/features/auto-creation.md` |
| `docs/bulk-performance_Version3` | `docs/features/bulk-operations.md` |
| `docs/global-filter-query.md` | `docs/features/global-filter.md` |
| `docs/InlineTaskParser-Examples.md` | `docs/features/inline-task-parser.md` |
| `docs/InlineTaskSyntax.md` | *(merged into above)* |
| `docs/natural-language.md` | `docs/features/natural-language-dates.md` |
| `docs/NATURAL_LANGUAGE_DATES.md` | *(merged into above)* |
| `docs/outbound-webhooks_Version2.md` | `docs/features/outbound-webhooks.md` |
| `docs/recurrence-edge-cases_Version2` | `docs/features/recurrence-edge-cases.md` |
| `docs/keyboard-shortcuts-reference.md` | `docs/guides/keyboard-shortcuts.md` |
| `docs/migration-guide.md` | `docs/guides/migration.md` |
| `docs/mobile.md` | `docs/guides/mobile-usage.md` |
| `docs/presets.md` | `docs/guides/presets.md` |
| `docs/query-examples.md` | `docs/guides/query-examples.md` |
| `docs/query-language.md` | `docs/guides/query-language.md` |
| `docs/QUERY_LANGUAGE.md` | *(merged into above)* |
| `docs/RECURRENCE_GUIDE.md` | `docs/guides/recurrence.md` |
| `docs/settings-guide.md` | `docs/guides/settings.md` |
| `docs/split-view-dashboard.md` | `docs/guides/split-view.md` |
| `docs/split-view-migration.md` | *(merged into above)* |
| `docs/task-format-reference.md` | `docs/guides/task-format.md` |
| `docs/ICON_SYSTEM.md` | `docs/architecture/icon-system.md` |
| `docs/ICON_IMPLEMENTATION_SUMMARY.md` | `docs/internal/icon-implementation-summary.md` |
| `docs/OPTIMISTIC_UPDATE_GUIDE.md` | `docs/architecture/optimistic-updates.md` |
| `docs/PHASE1_COMPLETION_SUMMARY.md` | `docs/internal/phase1-completion-summary.md` |
| `docs/PHASE3_FEATURES.md` | `docs/architecture/phase3-features.md` |
| `docs/PHASE4_USER_GUIDE.md` | `docs/architecture/phase4-user-guide.md` |
| `docs/RRULE_ENGINE_IMPLEMENTATION.md` | `docs/architecture/rrule-engine.md` |
| `docs/SHORTCUTS.md` | `docs/architecture/shortcuts-implementation.md` |
| `docs/advanced-features.md` | `docs/features/advanced-features.md` |
| `examples/http/` | `docs/api/http-examples/` |

---

## 4. Import Path Updates Required

After moving files, these import patterns need updating:

### 4.1 Config Files (if moved to config/)
```typescript
// In package.json scripts, vite, vitest references
// Update paths from "./" to "./config/"
```

### 4.2 Store Imports (if renamed to kebab-case)
```typescript
// Before
import { taskStore } from '@stores/taskAnalyticsStore';

// After  
import { taskStore } from '@stores/task-analytics-store';
```

### 4.3 Path Alias Updates (tsconfig.json)
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@backend/*": ["./src/backend/*"],
      "@frontend/*": ["./src/frontend/*"],
      "@shared/*": ["./src/shared/*"],
      "@stores/*": ["./src/frontend/stores/*"],
      "@components/*": ["./src/frontend/components/*"]
    }
  }
}
```

---

## 5. Safety Checklist

- [ ] Backup current state (git commit or zip)
- [ ] Run existing tests before changes
- [ ] Update all import paths in code
- [ ] Update path aliases in tsconfig.json
- [ ] Update vite.config.ts paths if configs moved
- [ ] Update package.json script paths
- [ ] Run build after changes
- [ ] Run tests after changes
- [ ] Verify plugin loads in SiYuan

---

## 6. Recommendation

**Phase 1 (Low Risk):** Move documentation files only
- Root MD files → docs/internal/
- Reorganize docs/ subfolders
- No code changes required

**Phase 2 (Medium Risk):** Move scripts
- Utility scripts to scripts/dev/
- Update package.json if needed

**Phase 3 (Higher Risk - Optional):** Rename source files to kebab-case
- Requires comprehensive import updates
- Should be done with automated tooling
- May break path aliases

**My Recommendation:** Execute Phase 1 and Phase 2 only. Phase 3 (source file renaming) adds significant risk for minimal benefit since the codebase works and TypeScript conventions allow PascalCase for classes and camelCase for instances.
