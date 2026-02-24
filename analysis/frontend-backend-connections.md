# Frontend-Backend Connection Analysis

## Analysis Date: February 14, 2026

## Summary

Frontend **DOES** extensively import from backend modules, primarily through path aliases (`@backend/*`).

**Total Frontend Files Importing Backend**: 80+ files
**Primary Backend Modules Used**:
- `@backend/core/models/Task` (most common)
- `@backend/core/query/*`
- `@backend/core/ai/*`
- `@backend/services/*`
- `@backend/logging/*`
- `@backend/commands/*`
- `@backend/core/file/*`
- `@backend/core/block-actions/*`

## Connection Patterns

### Pattern 1: Type Imports (Read-Only)
**Use Case**: Frontend components importing backend types for type safety

```typescript
// Frontend components importing Task type
import type { Task } from "@backend/core/models/Task";
import type { TaskPriority } from "@backend/core/models/Task";
import type { QueryResult } from "@backend/core/query/QueryEngine";
```

**Files**: 50+ frontend files
**Impact**: Type-only imports, no runtime dependency

### Pattern 2: Service Layer Imports
**Use Case**: Frontend calling backend services/adapters

```typescript
// Frontend using backend services
import { TaskModelAdapter, type UnifiedTask } from '@backend/services/TaskAdapterService';
import { SmartSuggestionEngine } from '@backend/core/ai/SmartSuggestionEngine';
import { replaceTaskWithTasks } from "@backend/core/file/File";
```

**Files**: 15+ frontend files
**Impact**: Direct runtime dependency on backend logic

### Pattern 3: Utility/Logger Imports
**Use Case**: Frontend using shared backend utilities

```typescript
import * as logger from '@backend/logging/logger';
```

**Files**: 8+ frontend files
**Impact**: Shared infrastructure dependency

### Pattern 4: Re-exports
**Use Case**: Frontend creating clean API boundaries

```typescript
// frontend/components/shared/Task/Task.ts
export { type Task } from "@backend/core/models/Task";

// frontend/components/shared/Query/QueryResult.ts
export { type QueryResult } from "@backend/core/query/QueryEngine";
```

**Files**: 5+ re-export files
**Status**: ⚠️ **Unnecessary** - These can be deleted, import directly from backend

## Detailed Connection Map

### Frontend Components → Backend Core Models

| Frontend Component | Backend Module | Import Type |
|-------------------|----------------|-------------|
| **Shared Components** |
| `TimelineView.svelte` | `@backend/core/models/Task` | Type |
| `DockPanel.svelte` | `@backend/core/models/Task` | Type |
| `AISuggestionsPanel.svelte` | `@backend/core/ai/SmartSuggestionEngine` | Runtime |
| `AISuggestionsPanel.svelte` | `@backend/services/TaskAdapterService` | Runtime |
| `EditTaskUnified.ts` | `@backend/core/models/Task` | Type |
| `EditTaskUnified.ts` | `@backend/services/TaskAdapterService` | Runtime |
| `EditTaskUnified.ts` | `@backend/core/ai/SmartSuggestionEngine` | Type |
| `EditTaskUnified.ts` | `@backend/core/block-actions/BlockActionTypes` | Type |
| `EditTaskUnified.ts` | `@backend/logging/logger` | Runtime |
| **Menus** |
| `StatusMenu.ts` | `@backend/core/models/Task` | Type |
| `PriorityMenu.ts` | `@backend/core/models/Task` | Type |
| `PostponeMenu.ts` | `@backend/core/models/Task` | Type |
| `DateMenu.ts` | `@backend/core/models/Task` | Type |
| `TaskEditingMenu.ts` | `@backend/core/models/Task` | Type |
| `TaskEditingMenu.ts` | `@backend/core/file/File` | Runtime |
| **Utils** |
| `taskHelpers.ts` | `@backend/core/models/Task` | Type |
| `dependencyHelpers.ts` | `@backend/core/models/Task` | Type |
| `editableTask.ts` | `@backend/core/models/Task` | Type |
| `editableTask.ts` | `@backend/core/file/File` | Runtime |
| `inlineErrorHints.ts` | `@backend/logging/logger` | Runtime |
| **Query Components** |
| `QueryResult.ts` | `@backend/core/query/QueryEngine` | RE-EXPORT |
| `Grouper.ts` | `@backend/core/query/groupers/GrouperBase` | RE-EXPORT |
| **Modals** |
| `KeyboardShortcutsDialog.svelte` | `@backend/commands/ShortcutManager` | Type |

### Frontend Stores → Backend

| Store File | Backend Module | Import Type |
|-----------|----------------|-------------|
| `Task.store.ts` | `../domain/models/Task` | Type (⚠️ wrong path) |
| `Task.store.ts` | `../application/actions/CompletionHandler` | Runtime (⚠️ wrong path) |
| `Task.store.ts` | `../domain/index/TaskIndex` | Runtime (⚠️ wrong path) |
| `Search.store.ts` | `@backend/core/models/Task` | Type (✅ correct) |
| `TaskAnalytics.store.ts` | `@backend/core/models/Task` | Type (✅ correct) |
| `TaskOrder.store.ts` | `@backend/core/models/Task` | Type (✅ correct) |

**Issues Found**:
- `Task.store.ts` uses relative paths (`../domain/`, `../application/`) instead of aliases
- These imports are **BROKEN** (cause TypeScript errors)
- Should use `@domain/*` or `@backend/*` aliases

### Frontend Utils → Backend

| Frontend Util | Backend Module | Purpose |
|--------------|----------------|---------|
| `taskHelpers.ts` | `@backend/core/models/Task` | Task manipulation utilities |
| `accessibility.ts` | `@domain/models/Task` (⚠️) | Accessibility helpers |

**Issues**:
- `accessibility.ts` imports from `@domain/models/Task` instead of `@backend/core/models/Task`
- Causes type conflicts

## Backend Modules Most Used by Frontend

| Backend Module | Frontend Importers | Usage Type |
|---------------|-------------------|------------|
| `@backend/core/models/Task` | 30+ files | Types & interfaces |
| `@backend/core/query/*` | 10+ files | Query engine types |
| `@backend/core/ai/*` | 5+ files | AI suggestions |
| `@backend/services/*` | 8+ files | Service layer |
| `@backend/logging/logger` | 8+ files | Logging |
| `@backend/core/file/*` | 3+ files | File operations |
| `@backend/commands/*` | 2+ files | Command handlers |

## Architecture Pattern

The codebase follows a **Layered Architecture** pattern:

```
Frontend (UI Layer)
    ↓ (imports types & calls services)
Backend Services (Application Layer)
    ↓ (orchestrates)
Backend Core (Domain Layer)
    ↓ (uses)
Backend Models (Domain Models)
```

**Good Practices Found**:
- Frontend mostly imports types (not implementations)
- Service layer acts as facade
- Clear separation between read (types) and write (services)

**Issues Found**:
- Some frontend files directly import from `@domain/*` (bypassing backend layer)
- Re-export files are unnecessary
- Some stores use relative paths instead of aliases

## Recommendations

### 1. Standardize Import Paths ✅
**Action**: Update all frontend imports to use path aliases consistently

```typescript
// ❌ Bad - relative paths
import type { Task } from '../domain/models/Task';

// ✅ Good - path alias
import type { Task } from '@backend/core/models/Task';
```

**Files to fix**:
- `src/frontend/stores/Task.store.ts`
- `src/frontend/stores/Settings.store.ts`
- `src/frontend/utils/accessibility.ts`

### 2. Remove Frontend Re-exports ✅
**Action**: Delete unnecessary re-export files, import directly

**Files to delete**:
- `src/frontend/components/shared/Task/Task.ts` (just re-exports)
- `src/frontend/components/shared/Query/QueryResult.ts` (just re-exports)
- `src/frontend/components/shared/Query/Group/Grouper.ts` (just re-exports)

### 3. Fix Domain vs Backend Core Imports ✅
**Action**: Decide on canonical Task model location

**Option A**: Use `@backend/core/models/Task` everywhere (RECOMMENDED)
**Option B**: Use `@domain/models/Task` everywhere

**Recommendation**: Option A - backend/core is the source of truth

### 4. Centralize Service Access ✅
**Action**: Consider creating a facade/service registry

```typescript
// frontend/services/index.ts
export { SmartSuggestionEngine } from '@backend/core/ai/SmartSuggestionEngine';
export { TaskModelAdapter } from '@backend/services/TaskAdapterService';
export { replaceTaskWithTasks } from '@backend/core/file/File';
```

**Benefit**: Single point of import for all backend services

## Frontend-Backend Coupling Analysis

| Coupling Level | Count | Severity |
|---------------|-------|----------|
| **Type-only** (low coupling) | 50+ files | ✅ LOW |
| **Service calls** (medium coupling) | 15 files | ⚠️ MEDIUM |
| **Direct imports** (high coupling) | 5 files | ❌ HIGH |

**Overall Assessment**: MEDIUM coupling
- Most frontend only imports types (good!)
- Some direct service calls (acceptable)
- Few direct core logic imports (should be avoided)

## Next Steps

1. ✅ Fix broken frontend imports (Task.store.ts, Settings.store.ts)
2. ✅ Standardize to `@backend/core/models/Task` as canonical
3. ✅ Delete frontend re-export files
4. ⬜ Create frontend service facade (optional improvement)
5. ⬜ Document frontend-backend contract (API boundaries)

---

**Connection Status**: ✅ **Well Connected**  
**Architecture Health**: ⚠️ **Good with minor issues**  
**Refactoring Priority**: **MEDIUM** (fix broken imports, then optional improvements)
