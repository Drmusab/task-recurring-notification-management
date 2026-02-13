# TypeScript Error Fix Summary

**Date:** February 13, 2026  
**Status:** Analysis Complete  

---

## Root Cause Analysis

### Issue 1: Duplicate Task Models

There are TWO Task interfaces in the codebase:

1. **Domain Model** - `src/domain/models/Task.ts`
   - Full-featured, Obsidian parity
   - `dueAt?: string` (optional)
   - Uses `Recurrence` interface

2. **Backend Model** - `src/backend/core/models/Task.ts`
   - Simplified version
   - `dueAt: string` (required)
   - Uses deprecated `Frequency` interface

**Problem:** Code imports and uses both, causing type conflicts.

### Issue 2: Recurrence Interface Mismatch

The `RecurrenceEngine` expects:
```typescript
task.frequency.rruleString  // Doesn't exist
task.frequency.dtstart      // Doesn't exist
task.frequency.whenDone     // Doesn't exist
task.frequency.time         // Doesn't exist
```

But the actual `Recurrence` interface has:
```typescript
interface Recurrence {
  rrule: string;            // Not "rruleString"
  baseOnToday: boolean;     // Not "whenDone"
  timezone?: string;        // ✓ Exists
  referenceDate?: Date | string; // Not "dtstart"
  // No "time" property
}
```

### Issue 3: @ts-nocheck Usage

Multiple files use `@ts-nocheck` to suppress errors instead of fixing them:
- `Settings.ts`
- `StatusSettings.ts`
- `QueryEngine.ts`
- `QueryParser.ts`
- `Cache.ts`

---

## Fix Strategy

### Phase 1: Unify Task Models (Priority: HIGH)

**Decision:** Use domain model as single source of truth

**Action Plan:**
1. Update all backend code to import from  `domain/models/Task`
2. Remove `backend/core/models/Task.ts`
3. Update all imports across codebase
4. Handle optional `dueAt` properly with null checks

### Phase 2: Fix Recurrence Interface (Priority: HIGH)

**Decision:** Update RecurrenceEngine to use correct Recurrence interface

**Action Plan:**
1. Change all `task.frequency.*` to `task.recurrence.*`
2. Map property names:
   - `rruleString` → `rrule`
   - `whenDone` → `baseOnToday`
   - `dtstart` → derive from `referenceDate` or `dueAt`
   - `time` → parse from `dueAt` ISO string
3. Add proper null checks for optional properties

### Phase 3: Remove @ts-nocheck (Priority: MEDIUM)

**Action Plan:**
1. Fix actual type errors file by file
2. Remove `@ts-nocheck` pragma
3. Verify compilation succeeds
4. Commit each fix separately

---

## Implementation Order

1. **Fix domain model imports** (2 hours)
   - Global find/replace for Task imports
   - Update type signatures
   - Test compilation

2. **Fix RecurrenceEngine** (3 hours)
   - Update property access
   - Add property mappers
   - Add null guards
   - Test recurrence calculations

3. **Fix remaining type errors** (2 hours)
   - Settings.ts
   - StatusSettings.ts
   - Cache.ts

4. **Remove @ts-nocheck** (1 hour)
   - One file at a time
   - Verify each removal

5. **Validation** (1 hour)
   - Run `tsc --noEmit`
   - Run tests
   - Fix any remaining issues

**Total Estimated Time:** 9 hours (1-2 days)

---

## Files to Modify

### High Priority
- [ ] All files importing Task from backend/core/models
- [ ] RecurrenceEngine.ts
- [ ] RecurrenceEngineRRULE.ts
- [ ] CompletionHandler.ts

### Medium Priority
- [ ] Settings.ts
- [ ] StatusSettings.ts
- [ ] QueryEngine.ts
- [ ] QueryParser.ts

### Low Priority
- [ ] Cache.ts (will be rewritten anyway)

---

## Testing Strategy

After each fix:
1. Run `npm run type-check` (tsc --noEmit)
2. Run `npm test` for affected modules
3. Manual testing of recurrence calculations
4. Verify no runtime errors

---

## Next Steps

Proceed with implementation starting with unifying Task models.
