# Global Filter + Global Query Design

## Goals
- Apply a **Global Filter** as a hard exclusion layer before tasks are indexed.
- Apply a **Global Query** as default query conditions merged into every query.
- Keep it fast by caching parsed queries and compiling filter matchers once.
- Preserve per-query flexibility with an opt-out directive.

## Responsibilities
### Global Filter (Hard Exclusion)
- Decides whether a checkbox line should be treated as a task **before indexing**.
- Supports exclusion of:
  - Folders (glob/regex)
  - Notebooks (glob/regex)
  - Tags (wildcards)
  - File patterns (glob/regex)
  - Status types
- Must be applied in the parser/indexer path.

### Global Query (Default Conditions)
- Adds an implicit **AND** between global query filters and a local query.
- Parsed once and cached.
- Invalid global queries must surface errors and block execution.
- Per-query opt-out: `ignore global query` line in local query text.

## Module List + Interfaces
### `src/core/filtering/GlobalFilter.ts`
- Singleton that owns `GlobalFilterEngine`.
- `shouldTreatAsTask(line, path?)` for pre-index filtering.
- `shouldIncludeTask(task)` for previews.

### `src/core/filtering/GlobalFilterEngine.ts`
- Compiles exclusion patterns once on config changes.
- `evaluate(line, path?)` for block-level filtering.
- `evaluateTask(task)` for indexed-task preview.

### `src/core/query/GlobalQuery.ts`
- Singleton that caches parsed AST.
- `getAST()`, `getError()`, `isEnabled()`.

### `src/core/query/QueryComposer.ts`
- Merges global + local ASTs by concatenating filter nodes.
- Strips `ignore global query` directive from local text.

### `src/core/query/QueryExplain.ts`
- Pure helper that explains query ASTs for UI validation.

## Execution Order
1. Parse task line
2. Apply Global Filter
3. Index task (if allowed)
4. Apply Global Query
5. Apply Local Query
6. Sort / group / limit
7. Render dashboard / inline

## Settings Schema + Defaults
```ts
interface GlobalFilterConfig {
  enabled: boolean;
  mode: 'include' | 'exclude' | 'all';
  rules: FilterRule[]; // legacy rules still honored
  excludeFolders: string[];
  excludeNotebooks: string[];
  excludeTags: string[];
  excludeFilePatterns: string[];
  excludeStatusTypes: StatusType[];
}

interface GlobalQueryConfig {
  enabled: boolean;
  query: string;
}
```
Defaults:
- `globalFilter.enabled = false`
- `globalFilter.exclude* = []`
- `globalQuery.enabled = false`
- `globalQuery.query = ""`

## Implementation Plan (Phases)
### Phase 1 — Core plumbing
- Extend global filter config to support exclusions.
- Compile glob/regex matchers on config update.
- Add GlobalQuery singleton and QueryComposer.

### Phase 2 — Query composition
- Use QueryComposer in inline queries + dashboard search.
- Block execution with understandable error when global query is invalid.

### Phase 3 — Settings UI
- Add Global Filtering & Query section:
  - Exclusion lists (folders, notebooks, tags, file patterns)
  - Status type toggles
  - Live preview of excluded tasks
  - Global query editor with validate/explain
  - Panic switch + reset

### Phase 4 — Refresh behavior
- Emit settings change events to refresh query caches.
- Ensure global filter changes trigger index refresh (incremental if available).

## Test Plan
### Exclusion tests
- Folder exclusion `/archive/**` removes tasks from that path.
- Tag exclusion `#journal` removes tasks containing that tag.
- Status exclusion `CANCELLED` removes cancelled tasks.
- File pattern exclusion using regex and glob.

### Query composition tests
- Global query + local query combine as AND.
- Local query `ignore global query` bypasses global query.
- Empty global query is a no-op.

### Regression tests
- Default settings produce identical results to pre-feature behavior.
- Invalid global query reports error and prevents execution.
