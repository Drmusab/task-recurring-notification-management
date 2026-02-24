# File Usage Audit - Critical Duplicates

## Analysis Date: February 14, 2026

## PRIORITY 1: RecurrenceEngine (4 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/engine/recurrence/RecurrenceEngine.ts` | ~400 | 18 files | ✅ PRIMARY | **KEEP** - This is the main implementation |
| `src/backend/core/recurrence/RecurrenceEngine.ts` | ~300 | 1 file | 🔄 DUPLICATE | **CONSOLIDATE** - Only used by RecurrencePreviewService |
| `src/backend/services/RecurrenceEngine.ts` | ~250 | 0 files | ❌ ORPHAN | **DELETE** - Not imported anywhere |
| `src/domain/recurrence/RecurrenceEngine.ts` | ~200 | 0 files | ❌ ORPHAN | **DELETE** - Not imported anywhere, just documentation |

**Consolidation Plan**:
1. Update `RecurrencePreviewService.ts` to import from `engine/recurrence/`
2. Delete `backend/core/recurrence/RecurrenceEngine.ts`
3. Delete `backend/services/RecurrenceEngine.ts`
4. Delete `domain/recurrence/RecurrenceEngine.ts`

---

## PRIORITY 2: Task Model (5 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/models/Task.ts` | ~800 | 35+ files | ✅ PRIMARY | **KEEP** - Main task model |
| `src/domain/models/Task.ts` | ~600 | 12 files | ⚠️  CONFLICT | **EVALUATE** - Used by domain layer & infrastructure |
| `src/backend/Task/Task.ts` | ~400 | 1 file | 🔄 DUPLICATE | **DELETE** after migration |
| `src/frontend/components/shared/Task/Task.ts` | ~5 | 1 file | 🔄 RE-EXPORT | **DELETE** - Just re-exports backend model |
| `src/shared/utils/task/Task.ts` | ~5 | 0 files | ❌ ORPHAN | **DELETE** - Just re-exports, not used |

**Type Conflict Issue**:
- `backend/core/models/Task` uses enhanced types with `version: number | undefined`
- `domain/models/Task` uses strict types with `version: number`
- This causes TypeScript errors in FrequencyToRecurrenceConverter.ts

**Consolidation Plan**:
1. **Decision needed**: Merge domain/models/Task into backend/core/models/Task OR keep separate for DDD
2. Update all `domain/models/Task` imports to use `backend/core/models/Task`
3. Delete `backend/Task/Task.ts`
4. Delete `frontend/components/shared/Task/Task.ts`
5. Delete `shared/utils/task/Task.ts`

**Recommended**: Keep `domain/models/Task` as the canonical model, update backend to use it

---

## PRIORITY 3: DependencyGraph (3 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/dependencies/DependencyGraph.ts` | ~350 | 8 files | ✅ PRIMARY | **KEEP** - Active implementation |
| `src/backend/core/engine/DependencyGraph.ts` | ~200 | 0 files | ❌ ORPHAN | **DELETE** - Not imported |
| `src/domain/dependencies/DependencyGraph.ts` | ~180 | 0 files | ❌ ORPHAN | **DELETE** - Not imported |

**Consolidation Plan**:
1. Verify no usage of engine/DependencyGraph
2. Delete `backend/core/engine/DependencyGraph.ts`
3. Delete `domain/dependencies/DependencyGraph.ts`

---

## PRIORITY 4: StatusRegistry (3 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/shared/constants/statuses/StatusRegistry.ts` | ~150 | 12 files | ✅ PRIMARY | **KEEP** - Main registry |
| `src/backend/core/models/StatusRegistry.ts` | ~120 | 0 files | ❌ ORPHAN | **DELETE** - Not imported |
| `src/shared/types/StatusRegistry.ts` | ~50 | 0 files | ❌ ORPHAN | **DELETE** - Type definition only |

**Consolidation Plan**:
1. Delete `backend/core/models/StatusRegistry.ts`
2. Delete `shared/types/StatusRegistry.ts`
3. Ensure all type references use `shared/constants/statuses/StatusRegistry`

---

## PRIORITY 5: Status (3 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/shared/constants/statuses/Status.ts` | ~100 | 15+ files | ✅ PRIMARY | **KEEP** - Main status constants |
| `src/backend/core/models/Status.ts` | ~80 | 0 files | ❌ ORPHAN | **DELETE** - Duplicate |
| `src/shared/types/Status.ts` | ~40 | 0 files | ❌ ORPHAN | **DELETE** - Type definition only |

**Consolidation Plan**:
1. Delete `backend/core/models/Status.ts`
2. Delete `shared/types/Status.ts`

---

## PRIORITY 6: TaskLine Parsers & Serializers (2 each)

### TaskLineParser

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/parsers/TaskLineParser.ts` | ~400 | 5 files | ✅ PRIMARY | **KEEP** - Active parser |
| `src/infrastructure/parsers/TaskLineParser.ts` | ~350 | 0 files | ❌ ORPHAN | **DELETE** - Old implementation |

### TaskLineSerializer

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/parsers/TaskLineSerializer.ts` | ~300 | 6 files | ✅ PRIMARY | **KEEP** - Active serializer |
| `src/infrastructure/parsers/TaskLineSerializer.ts` | ~280 | 0 files | ❌ ORPHAN | **DELETE** - Old implementation |

**Consolidation Plan**:
1. Delete `infrastructure/parsers/TaskLineParser.ts`
2. Delete `infrastructure/parsers/TaskLineSerializer.ts`
3. Verify no infrastructure code depends on these

---

## PRIORITY 7: Webhook vs Webhooks Folders

### webhook/ folder (OLD - 3 files)

| File Path | Status | Action |
|-----------|--------|--------|
| `src/backend/webhook/types/Error.ts` | ❌ ORPHAN | **DELETE** |
| `src/backend/webhook/types/Response.ts` | ❌ ORPHAN | **DELETE** |
| `src/backend/webhook/types/Request.ts` | ❌ ORPHAN | **DELETE** |

### webhooks/ folder (ACTIVE - 13 files)

| File Path | Importers | Status |
|-----------|-----------|--------|
| `src/backend/webhooks/index.ts` | 2 files | ✅ KEEP |
| `src/backend/webhooks/types/*.ts` | 5 files | ✅ KEEP |
| `src/backend/webhooks/inbound/*.ts` | 3 files | ✅ KEEP |
| `src/backend/webhooks/outbound/*.ts` | 3 files | ✅ KEEP |

**Consolidation Plan**:
1. Delete entire `src/backend/webhook/` folder (3 files)
2. Keep `src/backend/webhooks/` as the active implementation

---

## PRIORITY 8: Date Utilities (date/ vs dateTime/)

### src/shared/utils/date/ (3 files)

| File | Lines | Importers | Status |
|------|-------|-----------|--------|
| `index.ts` | ~50 | 8 files | ✅ KEEP |
| `date.ts` | ~200 | via index | ✅ KEEP |
| `timezone.ts` | ~150 | via index | ✅ KEEP |

### src/shared/utils/dateTime/ (8 files)

| File | Lines | Importers | Status |
|------|-------|-----------|--------|
| `date-abbreviations.ts` | ~50 | 2 files | 🔄 MERGE |
| `tasks-date.ts` | ~300 | 15 files | ✅ KEEP (rename) |
| `Postponer.ts` | ~100 | 3 files | 🔄 MERGE |
| `date-tools.ts` | ~250 | 12 files | ✅ KEEP (rename) |
| `date-range.ts` | ~150 | 8 files | ✅ KEEP |
| `date-field-types.ts` | ~80 | 5 files | ✅ KEEP |
| `date-fallback.ts` | ~40 | 2 files | 🔄 MERGE |

**Consolidation Options**:

**Option A: Keep Both** (Recommended)
- `date/` = Core date utilities (timezone, basic formatting)
- `dateTime/` = Task-specific date functionality
- Rename `dateTime/` to `task-date-utils/` for clarity

**Option B: Merge All**
- Consolidate all into `date-utils/` folder
- Organize by purpose (formatting, parsing, task-specific)

**Recommendation**: Option A - Keep separate, rename dateTime to task-date-utils

---

## PRIORITY 9: QueryParser (2 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/query/QueryParser.ts` | ~500 | 8 files | ✅ PRIMARY | **KEEP** - Active query parser |
| `src/domain/query/QueryParser.ts` | ~300 | 0 files | ❌ ORPHAN | **DELETE** - Old implementation |

**Consolidation Plan**:
1. Delete `domain/query/QueryParser.ts`
2. Update any domain references to use backend/core version

---

## PRIORITY 10: CompletionHandler (2 implementations)

| File Path | Lines | Importers | Status | Action |
|-----------|-------|-----------|--------|--------|
| `src/backend/core/actions/CompletionHandler.ts` | ~400 | 5 files | ✅ PRIMARY | **KEEP** - Main implementation |
| `src/application/actions/CompletionHandler.ts` | ~250 | 0 files | ❌ ORPHAN | **DELETE** - Appears unused |

**Consolidation Plan**:
1. Verify application layer doesn't need separate handler
2. If not, delete `application/actions/CompletionHandler.ts`
3. Update any application layer to use backend/core version

---

## Summary Statistics

| Category | Count | Lines Saved (est.) |
|----------|-------|-------------------|
| Orphan RecurrenceEngines | 2 | ~450 |
| Orphan Task models | 3 | ~20 (re-exports) |
| Orphan DependencyGraphs | 2 | ~380 |
| Orphan StatusRegistry | 2 | ~170 |
| Orphan Status | 2 | ~120 |
| Orphan Parsers | 2 | ~630 |
| Webhook folder | 3 | ~150 |
| Orphan QueryParser | 1 | ~300 |
| Orphan CompletionHandler | 1 | ~250 |
| **TOTAL (Priority 1-10)** | **18** | **~2,470** |

## Next Steps

1. Fix broken imports (Phase 2)
2. Delete orphan duplicates (Phase 2)
3. Consolidate active duplicates (Phase 3)
4. Resolve Task model conflict (Phase 3)
5. Standardize import paths (Phase 4)
6. Run full test suite (Phase 5)
