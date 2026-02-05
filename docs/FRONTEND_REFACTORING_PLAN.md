# Frontend Architecture Refactoring Plan
## SiYuan Task Management Plugin

**Date:** February 2, 2026  
**Status:** 📋 Refactoring Plan - Ready for Execution

---

## 🔍 Current State Analysis

### Current Structure Issues

```
src/
├── index.ts                    ✅ OK - Plugin entry point
├── adapters/                   ⚠️  Backend logic, not frontend
├── Api/                        ❌ PascalCase folder, unclear purpose
├── assets/                     ✅ OK - Static assets
├── bulk/                       ⚠️  Backend logic
├── calendar/                   ⚠️  Mixed concerns (UI + logic)
├── commands/                   ⚠️  Backend logic, not frontend
├── Config/                     ❌ PascalCase folder, should be lowercase
├── core/                       ⚠️  Backend logic, not frontend
├── DateTime/                   ❌ PascalCase folder
├── events/                     ⚠️  Backend logic
├── features/                   ⚠️  Mixed concerns
├── lib/                        ⚠️  Generic name, unclear
├── parser/                     ⚠️  Backend logic
├── recurrence/                 ⚠️  Backend logic
├── reminder/                   ⚠️  Mixed concerns (UI + logic)
├── Renderer/                   ❌ PascalCase folder
├── services/                   ⚠️  Backend logic
├── shehab/                     ❌ Unclear naming (developer name?)
├── src_tracker/                ❌ Bad naming with underscore
├── Statuses/                   ❌ PascalCase folder
├── stores/                     ✅ OK - State management
├── styles/                     ✅ OK - Global styles
├── Task/                       ❌ PascalCase folder, models not UI
├── types/                      ✅ OK - TypeScript types
├── ui/                         ⚠️  Only Svelte components, incomplete
├── utils/                      ⚠️  Mixed frontend/backend utilities
├── Visualizations/             ❌ PascalCase folder
└── webhook/                    ⚠️  Backend logic
```

### Key Problems

1. **Inconsistent Naming** - Mix of PascalCase, camelCase, snake_case folders
2. **No Frontend/Backend Separation** - Backend logic mixed with UI code
3. **Poor Organization** - Flat structure with unclear responsibilities
4. **Unclear Naming** - Folders like "shehab", "src_tracker", "Api"
5. **Duplicate Concerns** - Events logic in multiple places
6. **Missing Frontend Standards** - No clear component hierarchy

---

## 🎯 Proposed Frontend Architecture

### New Structure (Frontend Focus)

```
src/
├── index.ts                            # Plugin entry point
│
├── backend/                            # 🆕 Backend domain logic
│   ├── core/                           # Core business logic
│   │   ├── managers/                   # Service coordinators
│   │   ├── storage/                    # Data persistence
│   │   ├── engine/                     # Scheduler, recurrence
│   │   ├── models/                     # Domain models (Task, Frequency)
│   │   ├── ai/                         # AI/ML features
│   │   ├── settings/                   # Settings management
│   │   ├── events/                     # Event system
│   │   └── ...                         # Other backend modules
│   ├── adapters/                       # External integrations
│   ├── services/                       # Application services
│   ├── commands/                       # Command handlers
│   ├── parsers/                        # Text parsers
│   └── webhooks/                       # Webhook server
│
├── frontend/                           # 🆕 Frontend UI layer
│   ├── components/                     # Reusable UI components
│   │   ├── common/                     # Generic components
│   │   │   ├── Button.svelte
│   │   │   ├── Modal.svelte
│   │   │   ├── DatePicker.svelte
│   │   │   └── ...
│   │   ├── task/                       # Task-specific components
│   │   │   ├── TaskCard.svelte
│   │   │   ├── TaskList.svelte
│   │   │   ├── TaskEditor/
│   │   │   │   ├── TaskEditor.svelte
│   │   │   │   ├── BasicInfoSection.svelte
│   │   │   │   ├── RecurrenceSection.svelte
│   │   │   │   ├── DependencySection.svelte
│   │   │   │   └── AISuggestionsSection.svelte
│   │   │   └── ...
│   │   ├── calendar/                   # Calendar components
│   │   │   ├── CalendarView.svelte
│   │   │   ├── CalendarGrid.svelte
│   │   │   └── ...
│   │   ├── dashboard/                  # Dashboard components
│   │   │   ├── Dashboard.svelte
│   │   │   ├── StatsCard.svelte
│   │   │   └── ...
│   │   ├── analytics/                  # Analytics/visualization components
│   │   │   ├── AnalyticsPanel.svelte
│   │   │   ├── ChartWrapper.svelte
│   │   │   └── ...
│   │   └── reminders/                  # Reminder components
│   │       ├── ReminderList.svelte
│   │       └── ...
│   │
│   ├── views/                          # Page-level views/containers
│   │   ├── TaskListView.svelte
│   │   ├── CalendarView.svelte
│   │   ├── DashboardView.svelte
│   │   └── SettingsView.svelte
│   │
│   ├── modals/                         # Modal dialogs
│   │   ├── TaskModal.ts
│   │   ├── OptionsModal.ts
│   │   ├── ConfirmDialog.ts
│   │   └── ...
│   │
│   ├── hooks/                          # Svelte/TypeScript hooks
│   │   ├── useTaskManager.ts
│   │   ├── useOptimisticUpdate.ts
│   │   ├── useScheduler.ts
│   │   └── ...
│   │
│   ├── stores/                         # Frontend state management
│   │   ├── taskStore.ts                # Task state
│   │   ├── uiStore.ts                  # UI state
│   │   ├── settingsStore.ts            # Settings state
│   │   └── analyticsStore.ts           # Analytics state
│   │
│   └── utils/                          # Frontend-only utilities
│       ├── formatting.ts               # Date/string formatting
│       ├── validation.ts               # Input validation
│       ├── domHelpers.ts               # DOM manipulation
│       └── ...
│
├── shared/                             # 🆕 Shared utilities (frontend + backend)
│   ├── types/                          # Shared TypeScript types
│   │   ├── task.types.ts
│   │   ├── api.types.ts
│   │   └── ...
│   ├── constants/                      # Shared constants
│   │   ├── dates.ts
│   │   ├── config.ts
│   │   └── ...
│   ├── utils/                          # Shared utilities
│   │   ├── logger.ts
│   │   ├── validators.ts
│   │   └── ...
│   └── config/                         # Shared configuration
│       ├── settings.ts
│       ├── defaults.ts
│       └── ...
│
├── assets/                             # Static assets
│   ├── icons/                          # ✅ Already well organized
│   ├── images/
│   └── fonts/
│
└── styles/                             # Global styles
    ├── main.scss                       # Main stylesheet
    ├── variables.scss                  # CSS variables
    ├── mixins.scss                     # SCSS mixins
    └── themes/                         # Theme files
```

---

## 📦 Migration Mapping

### Phase 1: Backend Separation

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `src/core/` | `src/backend/core/` | Backend business logic |
| `src/adapters/` | `src/backend/adapters/` | External integrations |
| `src/commands/` | `src/backend/commands/` | Command handlers |
| `src/services/` | `src/backend/services/` | Application services |
| `src/events/` | `src/backend/core/events/` | Event system |
| `src/webhook/` | `src/backend/webhooks/` | Webhook server |
| `src/parser/` | `src/backend/parsers/` | Text parsing logic |
| `src/recurrence/` | `src/backend/core/recurrence/` | Recurrence logic |
| `src/bulk/` | `src/backend/bulk/` | Bulk operations |

### Phase 2: Frontend Organization

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `src/ui/EditTask.svelte` | `src/frontend/components/task/TaskEditor/TaskEditor.svelte` | Main task editor |
| `src/ui/DateEditor.svelte` | `src/frontend/components/task/TaskEditor/DateSection.svelte` | Date editing section |
| `src/ui/RecurrenceEditor.svelte` | `src/frontend/components/task/TaskEditor/RecurrenceSection.svelte` | Recurrence section |
| `src/ui/PriorityEditor.svelte` | `src/frontend/components/task/TaskEditor/PrioritySection.svelte` | Priority section |
| `src/ui/StatusEditor.svelte` | `src/frontend/components/task/TaskEditor/StatusSection.svelte` | Status section |
| `src/ui/AISuggestionsPanel.svelte` | `src/frontend/components/task/TaskEditor/AISuggestionsSection.svelte` | AI suggestions |
| `src/ui/BlockActionsEditor.svelte` | `src/frontend/components/task/TaskEditor/BlockActionsSection.svelte` | Block actions |
| `src/ui/TrackerDashboard.svelte` | `src/frontend/components/dashboard/Dashboard.svelte` | Main dashboard |
| `src/shehab/TaskModal.ts` | `src/frontend/modals/TaskModal.ts` | Task modal controller |
| `src/shehab/OptionsModal.ts` | `src/frontend/modals/OptionsModal.ts` | Options modal |
| `src/Renderer/TaskLineRenderer.ts` | `src/frontend/components/task/TaskLineRenderer.ts` | Task line rendering |
| `src/calendar/` (UI parts) | `src/frontend/components/calendar/` | Calendar components |
| `src/reminder/ui/` | `src/frontend/components/reminders/` | Reminder components |
| `src/Visualizations/` | `src/frontend/components/analytics/` | Analytics visualizations |

### Phase 3: Shared Utilities

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `src/types/` | `src/shared/types/` | Shared type definitions |
| `src/utils/constants.ts` | `src/shared/constants/config.ts` | Shared constants |
| `src/utils/logger.ts` | `src/shared/utils/logger.ts` | Shared logger |
| `src/Config/` | `src/shared/config/` | Shared configuration |
| `src/Task/` (models) | `src/backend/core/models/` | Domain models |
| `src/DateTime/` | `src/shared/utils/dates/` | Date utilities |
| `src/Statuses/` | `src/shared/constants/statuses.ts` | Status constants |

### Phase 4: State Management

| Current Location | New Location | Reason |
|-----------------|--------------|--------|
| `src/stores/taskAnalyticsStore.ts` | `src/frontend/stores/analyticsStore.ts` | Analytics state |
| `src/ui/SettingsStore.ts` | `src/frontend/stores/settingsStore.ts` | Settings state |
| `src/core/ui/TaskUIState.ts` | `src/frontend/stores/taskUIStore.ts` | Task UI state |

---

## 🚀 Execution Strategy

### Step 1: Create New Structure (Non-Breaking)

1. Create new folder structure alongside existing
2. No file moves yet - just scaffolding
3. Create barrel exports (`index.ts`) for each module

### Step 2: Move Backend Files

1. Move core backend logic to `backend/`
2. Update imports progressively
3. Test after each major move

### Step 3: Reorganize Frontend

1. Move UI components to `frontend/components/`
2. Organize by feature/responsibility
3. Create component directories for complex components
4. Update imports

### Step 4: Extract Shared Code

1. Move shared utilities to `shared/`
2. Separate frontend-only from backend-only
3. Update all imports

### Step 5: Clean Up

1. Remove old empty folders
2. Update all import paths
3. Update tsconfig path aliases
4. Run tests to verify

---

## 📝 Naming Conventions

### Folder Names
- ✅ **Use:** `camelCase` for all folders
- ✅ **Use:** Plural for collections: `components/`, `hooks/`, `stores/`
- ✅ **Use:** Singular for single responsibility: `analytics/`, `calendar/`
- ❌ **Avoid:** PascalCase folders
- ❌ **Avoid:** snake_case folders
- ❌ **Avoid:** Abbreviations without context

### File Names
- ✅ **Components:** `PascalCase.svelte` - `TaskEditor.svelte`
- ✅ **TypeScript:** `camelCase.ts` - `taskManager.ts`
- ✅ **Utilities:** `camelCase.ts` - `dateHelpers.ts`
- ✅ **Types:** `camelCase.types.ts` - `task.types.ts`
- ✅ **Constants:** `UPPER_SNAKE_CASE.ts` or `camelCase.constants.ts`
- ✅ **Styles:** `camelCase.scss` - `taskEditor.scss`

### Component Organization
```
TaskEditor/
├── TaskEditor.svelte           # Main component
├── TaskEditor.scss             # Styles (if not in .svelte)
├── TaskEditor.test.ts          # Tests
├── index.ts                    # Barrel export
├── BasicInfoSection.svelte     # Sub-components
├── RecurrenceSection.svelte
└── ...
```

---

## 🔧 Import Path Aliases (tsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@backend/*": ["./src/backend/*"],
      "@frontend/*": ["./src/frontend/*"],
      "@shared/*": ["./src/shared/*"],
      "@components/*": ["./src/frontend/components/*"],
      "@stores/*": ["./src/frontend/stores/*"],
      "@hooks/*": ["./src/frontend/hooks/*"],
      "@assets/*": ["./src/assets/*"],
      "@styles/*": ["./src/styles/*"]
    }
  }
}
```

### Migration Example

**Before:**
```typescript
import { TaskManager } from '@backend/core/managers/TaskManager'; // Old mixed alias
import { Task } from '@backend/core/models/Task';
import { TaskModal } from '@shehab/TaskModal'; // Old folder structure
import { DateEditor } from '@ui/DateEditor.svelte'; // Old generic alias
```

**After:**
```typescript
import { TaskManager } from '@backend/core/managers/TaskManager';
import { Task } from '@backend/core/models/Task';
import { TaskModal } from '@frontend/modals/TaskModal';
import DateEditor from '@components/common/DateEditor.svelte';
```

---

## ✅ Benefits of This Structure

### 1. **Clear Separation of Concerns**
- Backend logic isolated in `backend/`
- Frontend UI isolated in `frontend/`
- Shared utilities in `shared/`

### 2. **Improved Developer Experience**
- Intuitive folder structure
- Easy to find components
- Clear naming conventions
- Consistent organization

### 3. **Better Scalability**
- Easy to add new features
- Component isolation
- Modular architecture
- Clear boundaries

### 4. **Easier Testing**
- Components grouped by feature
- Clear test file locations
- Mocking boundaries well-defined

### 5. **Better Code Reusability**
- Common components in `common/`
- Shared utilities clearly marked
- No duplicate code

---

## ⚠️ Risk Mitigation

### Breaking Changes
- **Risk:** Import paths change across entire codebase
- **Mitigation:** Use automated refactoring tools, update incrementally

### Build Failures
- **Risk:** Vite/TypeScript can't find modules
- **Mitigation:** Update `tsconfig.json` path aliases first, test build after each phase

### Lost Functionality
- **Risk:** Files moved incorrectly, imports broken
- **Mitigation:** Move in small batches, test after each batch, use git for rollback

---

## 📊 Implementation Checklist

### Phase 1: Preparation (1-2 hours)
- [ ] Create new folder structure (empty)
- [ ] Update `tsconfig.json` with path aliases
- [ ] Create barrel exports (`index.ts`) for each module
- [ ] Verify build still works

### Phase 2: Backend Migration (3-4 hours)
- [ ] Move `core/` → `backend/core/`
- [ ] Move `adapters/` → `backend/adapters/`
- [ ] Move `commands/` → `backend/commands/`
- [ ] Move `services/` → `backend/services/`
- [ ] Move `webhook/` → `backend/webhooks/`
- [ ] Update imports in backend files
- [ ] Test backend functionality

### Phase 3: Frontend Migration (4-6 hours)
- [ ] Reorganize `ui/` components → `frontend/components/`
- [ ] Move modals → `frontend/modals/`
- [ ] Create component subdirectories (TaskEditor, Calendar, etc.)
- [ ] Move `Visualizations/` → `frontend/components/analytics/`
- [ ] Move `stores/` → `frontend/stores/`
- [ ] Update imports in frontend files
- [ ] Test UI functionality

### Phase 4: Shared Code (2-3 hours)
- [ ] Move `types/` → `shared/types/`
- [ ] Move `Config/` → `shared/config/`
- [ ] Move `DateTime/` → `shared/utils/dates/`
- [ ] Move constants → `shared/constants/`
- [ ] Update imports across all files

### Phase 5: Cleanup (1-2 hours)
- [ ] Remove old empty folders
- [ ] Update all remaining imports
- [ ] Run full test suite
- [ ] Update documentation
- [ ] Verify build works
- [ ] Test plugin in SiYuan

### Phase 6: Documentation (1 hour)
- [ ] Update README with new structure
- [ ] Document folder organization
- [ ] Update contributing guidelines
- [ ] Create architecture diagram

---

## 🎯 Success Criteria

✅ All files organized by responsibility  
✅ Consistent naming conventions  
✅ Clear frontend/backend separation  
✅ No broken imports  
✅ All tests passing  
✅ Build succeeds  
✅ Plugin works in SiYuan  
✅ Code easier to navigate  
✅ New developers can understand structure  

---

## 📅 Estimated Timeline

- **Total Time:** 12-18 hours
- **Can be done in:** 2-3 days (4-6 hours per day)
- **Recommended:** Incremental refactoring over 1 week

---

## 🚦 Ready to Execute

This refactoring plan is **ready for implementation**. The structure follows modern frontend architecture best practices and will significantly improve code maintainability.

**Next Step:** Begin Phase 1 (Preparation) to create the new folder structure.
