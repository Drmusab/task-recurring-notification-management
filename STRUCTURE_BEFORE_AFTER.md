# Before vs After Structure Map

**Generated:** 2026-02-05

This document shows the exact file movements for the project reorganization.

---

## Quick Reference

| Metric | Before | After |
|--------|--------|-------|
| Root-level MD files | 11 | 2 (README.md, LICENSE) |
| Root-level scripts | 3 | 0 |
| docs/ subdirectories | 1 | 4 |
| scripts/ subdirectories | 0 | 3 |

---

## Detailed Mappings

### Root → docs/internal/ (9 files)

```
BEFORE                              AFTER
──────────────────────────────────────────────────────────────────
AI_AGENT_CODING_PROMPT.md      →    docs/internal/ai-agent-coding-prompt.md
BACKEND_AUDIT_REPORT.md        →    docs/internal/backend-audit-report.md
BACKEND_FIXES_SUMMARY.md       →    docs/internal/backend-fixes-summary.md
FRONTEND_AUDIT_REPORT.md       →    docs/internal/frontend-audit-report.md
FRONTEND_REFACTORING_PLAN.md   →    docs/internal/frontend-refactoring-plan.md
IMPLEMENTATION_SUMMARY.md      →    docs/internal/implementation-summary.md
INTEGRATION_TEST_CHECKLIST.md  →    docs/internal/integration-test-checklist.md
REFACTORING_PROGRESS.md        →    docs/internal/refactoring-progress.md
REFACTORING_QUICK_GUIDE.md     →    docs/internal/refactoring-quick-guide.md
```

### Root → scripts/dev/ (3 files)

```
BEFORE                          AFTER
──────────────────────────────────────────────────────────────────
debug-recurrence.js        →    scripts/dev/debug-recurrence.js
fix-relative-imports.cjs   →    scripts/dev/fix-relative-imports.cjs
update-imports.cjs         →    scripts/dev/update-imports.cjs
```

### docs/ Internal Reorganization (26 files)

```
BEFORE                                  AFTER
──────────────────────────────────────────────────────────────────
docs/AI_FEATURES.md                →    docs/features/ai-suggestions.md
docs/AUTO_CREATION.md              →    docs/features/auto-creation.md
docs/bulk-performance_Version3     →    docs/features/bulk-operations.md
docs/global-filter-query.md        →    docs/features/global-filter.md
docs/InlineTaskParser-Examples.md  →    docs/features/inline-task-parser-examples.md
docs/InlineTaskSyntax.md           →    docs/features/inline-task-syntax.md
docs/natural-language.md           →    docs/features/natural-language.md
docs/NATURAL_LANGUAGE_DATES.md     →    docs/features/natural-language-dates.md
docs/outbound-webhooks_Version2.md →    docs/features/outbound-webhooks.md
docs/recurrence-edge-cases_Version2→    docs/features/recurrence-edge-cases.md
docs/advanced-features.md          →    docs/features/advanced-features.md
docs/keyboard-shortcuts-reference.md→   docs/guides/keyboard-shortcuts.md
docs/migration-guide.md            →    docs/guides/migration.md
docs/mobile.md                     →    docs/guides/mobile-usage.md
docs/presets.md                    →    docs/guides/presets.md
docs/query-examples.md             →    docs/guides/query-examples.md
docs/query-language.md             →    docs/guides/query-language.md
docs/QUERY_LANGUAGE.md             →    docs/guides/query-language-reference.md
docs/RECURRENCE_GUIDE.md           →    docs/guides/recurrence.md
docs/settings-guide.md             →    docs/guides/settings.md
docs/split-view-dashboard.md       →    docs/guides/split-view.md
docs/split-view-migration.md       →    docs/guides/split-view-migration.md
docs/task-format-reference.md      →    docs/guides/task-format.md
docs/ICON_SYSTEM.md                →    docs/architecture/icon-system.md
docs/ICON_IMPLEMENTATION_SUMMARY.md→    docs/internal/icon-implementation-summary.md
docs/OPTIMISTIC_UPDATE_GUIDE.md    →    docs/architecture/optimistic-updates.md
docs/PHASE1_COMPLETION_SUMMARY.md  →    docs/internal/phase1-completion-summary.md
docs/PHASE3_FEATURES.md            →    docs/architecture/phase3-features.md
docs/PHASE4_USER_GUIDE.md          →    docs/architecture/phase4-user-guide.md
docs/RRULE_ENGINE_IMPLEMENTATION.md→    docs/architecture/rrule-engine.md
docs/SHORTCUTS.md                  →    docs/architecture/shortcuts-implementation.md
```

### scripts/ Reorganization (4 files)

```
BEFORE                              AFTER
──────────────────────────────────────────────────────────────────
scripts/make_dev_link.js       →    scripts/dev/make-dev-link.js
scripts/generate-plugin-images.js→  scripts/build/generate-plugin-images.js
scripts/generate-icons.js      →    scripts/icons/generate-icons.js
scripts/generate-png-placeholders.js→scripts/icons/generate-png-placeholders.js
```

### examples/ → docs/api/ (2 files)

```
BEFORE                              AFTER
──────────────────────────────────────────────────────────────────
examples/http/bulk-operations.http→ docs/api/http-examples/bulk-operations.http
examples/http/task-commands.http →  docs/api/http-examples/task-commands.http
```

### Files Removed (build artifacts)

```
build.log     (build artifact)
package.zip   (build artifact)
```

---

## Configuration Updates Required

### package.json

```diff
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "vite build",
    "test": "vitest run",
-   "make-link": "node --no-warnings ./scripts/make_dev_link.js"
+   "make-link": "node --no-warnings ./scripts/dev/make-dev-link.js"
  }
```

---

## New Directory Structure (After)

```
project-root/
├── .git/
├── .github/
│   └── copilot-instructions.md
├── .gitignore
├── dist/                          # Build output
├── docs/
│   ├── api/
│   │   └── http-examples/         # ← Moved from examples/http/
│   │       ├── bulk-operations.http
│   │       └── task-commands.http
│   ├── architecture/              # ← NEW
│   │   ├── icon-system.md
│   │   ├── optimistic-updates.md
│   │   ├── phase3-features.md
│   │   ├── phase4-user-guide.md
│   │   ├── rrule-engine.md
│   │   └── shortcuts-implementation.md
│   ├── features/                  # ← NEW
│   │   ├── advanced-features.md
│   │   ├── ai-suggestions.md
│   │   ├── auto-creation.md
│   │   ├── bulk-operations.md
│   │   ├── global-filter.md
│   │   ├── inline-task-parser-examples.md
│   │   ├── inline-task-syntax.md
│   │   ├── natural-language.md
│   │   ├── natural-language-dates.md
│   │   ├── outbound-webhooks.md
│   │   └── recurrence-edge-cases.md
│   ├── guides/                    # ← NEW
│   │   ├── keyboard-shortcuts.md
│   │   ├── migration.md
│   │   ├── mobile-usage.md
│   │   ├── presets.md
│   │   ├── query-examples.md
│   │   ├── query-language.md
│   │   ├── query-language-reference.md
│   │   ├── recurrence.md
│   │   ├── settings.md
│   │   ├── split-view.md
│   │   ├── split-view-migration.md
│   │   └── task-format.md
│   └── internal/                  # ← NEW (from root)
│       ├── ai-agent-coding-prompt.md
│       ├── backend-audit-report.md
│       ├── backend-fixes-summary.md
│       ├── frontend-audit-report.md
│       ├── frontend-refactoring-plan.md
│       ├── icon-implementation-summary.md
│       ├── implementation-summary.md
│       ├── integration-test-checklist.md
│       ├── phase1-completion-summary.md
│       ├── refactoring-progress.md
│       └── refactoring-quick-guide.md
├── i18n/
│   └── en_US.json
├── node_modules/
├── scripts/
│   ├── build/                     # ← NEW
│   │   └── generate-plugin-images.js
│   ├── dev/                       # ← NEW
│   │   ├── debug-recurrence.js
│   │   ├── fix-relative-imports.cjs
│   │   ├── make-dev-link.js
│   │   └── update-imports.cjs
│   ├── icons/                     # ← NEW
│   │   ├── generate-icons.js
│   │   └── generate-png-placeholders.js
│   └── reorganize-project.ps1
├── src/
│   ├── index.ts
│   ├── assets/
│   ├── backend/
│   ├── frontend/
│   └── shared/
├── tests/
│   ├── integration/
│   ├── security/
│   └── unit/
├── icon.png
├── icon.svg
├── LICENSE
├── package.json
├── package-lock.json
├── plugin.json
├── preview.png
├── preview.svg
├── README.md
├── REORGANIZATION_PLAN.md
├── STRUCTURE_BEFORE_AFTER.md      # This file
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## Validation Checklist

After running the reorganization script:

- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `npm run make-link` works (after updating package.json)
- [ ] Plugin loads successfully in SiYuan
- [ ] Git status shows expected changes
