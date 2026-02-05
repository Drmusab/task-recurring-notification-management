# Frontend Refactoring - Quick Reference Guide

## 🗂️ New Structure At-A-Glance

```
src/
├── backend/          # All business logic, data, services
├── frontend/         # All UI components, views, state
├── shared/           # Code used by both frontend & backend
├── assets/           # Static files (icons, images)
└── styles/           # Global styles
```

---

## 📁 Where Does Each File Type Go?

### Backend Files → `backend/`

| File Type | New Location | Example |
|-----------|--------------|---------|
| Managers/Coordinators | `backend/core/managers/` | `TaskManager.ts` |
| Data Models | `backend/core/models/` | `Task.ts`, `Frequency.ts` |
| Storage/Persistence | `backend/core/storage/` | `TaskStorage.ts` |
| Schedulers/Engines | `backend/core/engine/` | `Scheduler.ts` |
| Services | `backend/services/` | `EventService.ts` |
| Commands | `backend/commands/` | `TaskCommands.ts` |
| Parsers | `backend/parsers/` | `InlineTaskParser.ts` |
| Webhooks | `backend/webhooks/` | `WebhookServer.ts` |
| Adapters | `backend/adapters/` | `SiYuanApiAdapter.ts` |

### Frontend Files → `frontend/`

| File Type | New Location | Example |
|-----------|--------------|---------|
| Svelte Components | `frontend/components/[feature]/` | `TaskEditor.svelte` |
| Page Views | `frontend/views/` | `DashboardView.svelte` |
| Modals | `frontend/modals/` | `TaskModal.ts` |
| State Stores | `frontend/stores/` | `taskStore.ts` |
| Custom Hooks | `frontend/hooks/` | `useTaskManager.ts` |
| UI Utilities | `frontend/utils/` | `formatting.ts` |
| Renderers | `frontend/components/task/` | `TaskLineRenderer.ts` |

### Shared Files → `shared/`

| File Type | New Location | Example |
|-----------|--------------|---------|
| TypeScript Types | `shared/types/` | `task.types.ts` |
| Constants | `shared/constants/` | `config.ts` |
| Configuration | `shared/config/` | `settings.ts` |
| Common Utils | `shared/utils/` | `logger.ts`, `validators.ts` |
| Date Utilities | `shared/utils/dates/` | `dateHelpers.ts` |

---

## 🔄 Import Path Changes

### Path Alias Mapping

```typescript
// Old way
import { TaskManager } from '@/core/managers/TaskManager';
import { Task } from '@/core/models/Task';
import { logger } from '@/utils/logger';
import TaskEditor from '@/ui/EditTask.svelte';

// New way
import { TaskManager } from '@backend/core/managers/TaskManager';
import { Task } from '@backend/core/models/Task';
import { logger } from '@shared/utils/logger';
import TaskEditor from '@components/task/TaskEditor/TaskEditor.svelte';
```

### Common Import Patterns

```typescript
// Backend imports
import { TaskManager } from '@backend/core/managers/TaskManager';
import { TaskStorage } from '@backend/core/storage/TaskStorage';
import { Scheduler } from '@backend/core/engine/Scheduler';

// Frontend imports
import TaskCard from '@components/task/TaskCard.svelte';
import { taskStore } from '@stores/taskStore';
import { useOptimisticUpdate } from '@hooks/useOptimisticUpdate';

// Shared imports
import type { Task } from '@shared/types/task.types';
import { logger } from '@shared/utils/logger';
import { SCHEDULER_INTERVAL_MS } from '@shared/constants/config';
```

---

## 🎨 Component Organization Pattern

### Complex Components (with subdirectory)

```
TaskEditor/
├── TaskEditor.svelte           # Main component
├── TaskEditor.scss             # Styles (optional)
├── TaskEditor.test.ts          # Tests
├── index.ts                    # Barrel export: export { default } from './TaskEditor.svelte'
├── BasicInfoSection.svelte     # Sub-components
├── DateSection.svelte
├── RecurrenceSection.svelte
├── DependencySection.svelte
└── AISuggestionsSection.svelte
```

**Import:**
```typescript
import TaskEditor from '@components/task/TaskEditor';  // Uses index.ts
// or
import TaskEditor from '@components/task/TaskEditor/TaskEditor.svelte';
```

### Simple Components (single file)

```
components/
└── common/
    ├── Button.svelte
    ├── Modal.svelte
    └── DatePicker.svelte
```

**Import:**
```typescript
import Button from '@components/common/Button.svelte';
```

---

## 📋 Feature-Based Organization

### Task Management
```
frontend/components/task/
├── TaskCard.svelte             # Single task card
├── TaskList.svelte             # List of tasks
├── TaskEditor/                 # Complex editor with sections
├── TaskLineRenderer.ts         # Inline task rendering
└── TaskFilters.svelte          # Filter controls
```

### Calendar
```
frontend/components/calendar/
├── CalendarView.svelte         # Main calendar view
├── CalendarGrid.svelte         # Calendar grid
├── CalendarDay.svelte          # Single day cell
└── CalendarEvent.svelte        # Event display
```

### Dashboard
```
frontend/components/dashboard/
├── Dashboard.svelte            # Main dashboard
├── StatsCard.svelte            # Statistics card
├── OverviewPanel.svelte        # Overview section
└── RecentTasks.svelte          # Recent tasks list
```

### Analytics
```
frontend/components/analytics/
├── AnalyticsPanel.svelte       # Main analytics view
├── ChartWrapper.svelte         # Chart container
├── TrendChart.svelte           # Trend visualization
└── InsightCard.svelte          # Insight display
```

---

## 🛠️ Naming Quick Reference

### Folders
- ✅ `components/` - Plural
- ✅ `task/` - Singular (feature)
- ✅ `taskEditor/` - camelCase
- ❌ `TaskEditor/` - No PascalCase folders
- ❌ `task_editor/` - No snake_case

### Files
- ✅ `TaskEditor.svelte` - PascalCase for components
- ✅ `taskStore.ts` - camelCase for utilities
- ✅ `task.types.ts` - Descriptive extensions
- ❌ `task_editor.svelte` - No snake_case
- ❌ `taskeditor.svelte` - Use PascalCase

### Exports
```typescript
// Barrel export (index.ts)
export { default } from './TaskEditor.svelte';
export { default as DateSection } from './DateSection.svelte';

// Named exports
export { taskStore } from './taskStore';
export { useTaskManager } from './useTaskManager';
```

---

## 🚀 Migration Checklist (Per File)

### Moving a Backend File
1. [ ] Identify if truly backend logic (business logic, data, no UI)
2. [ ] Determine subdirectory: `core/`, `services/`, `commands/`, etc.
3. [ ] Move file to `backend/[subdirectory]/`
4. [ ] Update imports in the moved file
5. [ ] Find all files importing this file (use IDE "Find Usages")
6. [ ] Update import paths in all consuming files
7. [ ] Test build: `npm run build`
8. [ ] Test functionality

### Moving a Frontend Component
1. [ ] Identify component responsibility (task, calendar, dashboard, etc.)
2. [ ] Determine if complex (needs subdirectory) or simple
3. [ ] Move to `frontend/components/[feature]/`
4. [ ] If complex, create subdirectory and move related components
5. [ ] Update imports in the moved file
6. [ ] Create barrel export (`index.ts`) if complex
7. [ ] Find all imports and update paths
8. [ ] Test build and UI functionality

### Moving a Shared File
1. [ ] Verify file used by both frontend AND backend
2. [ ] Determine type: `types/`, `utils/`, `constants/`, `config/`
3. [ ] Move to `shared/[subdirectory]/`
4. [ ] Update imports in moved file
5. [ ] Update all consuming files
6. [ ] Test build

---

## ⚡ Quick Commands

### Search for Import References
```powershell
# Find all imports of a specific file
grep -r "from.*TaskManager" src/

# Find all imports from a specific folder
grep -r "from.*@/core/managers" src/
```

### Bulk Rename Imports (with sed/PowerShell)
```powershell
# Example: Replace old path with new path
(Get-Content -Path "src/**/*.ts" -Raw) -replace "@/core/managers", "@backend/core/managers" | Set-Content -Path "src/**/*.ts"
```

### Verify Build
```powershell
npm run build
```

### Run Tests
```powershell
npm run test
```

---

## 🎯 Common Scenarios

### Scenario 1: "Where does TaskModal.ts go?"
- **Answer:** `frontend/modals/TaskModal.ts`
- **Reason:** It's a UI modal controller

### Scenario 2: "Where does TaskStorage.ts go?"
- **Answer:** `backend/core/storage/TaskStorage.ts`
- **Reason:** It's backend data persistence logic

### Scenario 3: "Where do Task types go?"
- **Answer:** `shared/types/task.types.ts`
- **Reason:** Used by both frontend (components) and backend (storage)

### Scenario 4: "Where does logger.ts go?"
- **Answer:** `shared/utils/logger.ts`
- **Reason:** Used across frontend and backend

### Scenario 5: "Where does RecurrenceEditor.svelte go?"
- **Answer:** `frontend/components/task/TaskEditor/RecurrenceSection.svelte`
- **Reason:** It's a section of the task editor component

---

## ✅ Validation Checklist

After moving files, verify:

- [ ] No TypeScript errors: `npm run build`
- [ ] All tests pass: `npm run test`
- [ ] No broken imports (search for `from '@/`)
- [ ] Plugin loads in SiYuan
- [ ] UI renders correctly
- [ ] Task CRUD operations work
- [ ] Scheduler runs
- [ ] No console errors

---

## 📞 Need Help?

### Common Errors

**Error:** `Cannot find module '@backend/core/managers/TaskManager'`
- **Fix:** Check `tsconfig.json` has path alias configured
- **Fix:** Verify file exists at new location

**Error:** `Module not found: Error: Can't resolve '@components/task/TaskEditor'`
- **Fix:** Check if barrel export (`index.ts`) exists
- **Fix:** Try full path with `.svelte` extension

**Error:** Build succeeds but plugin crashes
- **Fix:** Check for circular dependencies
- **Fix:** Verify singleton getInstance() patterns still work

---

This guide provides everything needed for efficient refactoring!
