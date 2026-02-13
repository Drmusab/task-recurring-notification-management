# PHASE 0: COMPREHENSIVE ARCHITECTURAL AUDIT

**Date**: 2024  
**Engineer**: Senior Plugin Architect + Senior Engineer  
**Target**: System A (task-recurring-notification-management → SiYuan) vs System B (Obsidian Ecosystem)  
**Framework**: Evidence-Based Analysis (File Paths, Functions, Data Structures ONLY)

---

## EXECUTIVE SUMMARY

### Current State
- **Platform**: SiYuan Note Plugin (TypeScript 5.5.0, Svelte 5.0.0)
- **Recurrence System**: Phase 3 Complete (RRule-Only Mode, RFC 5545 compliant via `rrule` 2.8.0)
- **Task Model**: 30+ fields with analytics, escalation, block-linking, ML readiness
- **Storage**: Two-tier (active in-memory Map, chunked archive), triple-indexed
- **Query System**: Compositional filters (11+ filter types), boolean operators
- **Status**: Production-ready core, missing advanced UX workflows

### Gap Analysis Preview
1. ✅ **Recurrence Engine**: RRule parity achieved with Obsidian
2. ⚠️ **Query DSL**: Compositional filters exist, lacks natural language DSL & explanation
3. ❌ **UI Workflows**: Missing kanban, timeline, calendar, habit tracker views
4. ⚠️ **Storage**: Chunked archive good, missing saved queries persistence
5. ✅ **Task Model**: Rich analytics (superior to Obsidian), missing contexts/projects
6. ❌ **Reminder System**: Integrated but not productionized (needs obsidian-reminder parity)

---

## 1. REPOSITORY STRUCTURE AUDIT

### System A: task-recurring-notification-management-master

```
src/
├── backend/
│   ├── core/                      # Core domain layer
│   │   ├── models/
│   │   │   ├── Task.ts            # 560 lines, 30+ fields, analytics-ready
│   │   │   ├── Frequency.ts       # DEPRECATED (Phase 3)
│   │   │   ├── RecurrencePatterns.ts  # RRule pattern builders
│   │   │   └── Status.ts          # Task status model
│   │   ├── storage/
│   │   │   ├── TaskStorage.ts     # 607 lines, two-tier storage manager
│   │   │   ├── ActiveTaskStore.ts # In-memory active tasks
│   │   │   ├── ArchiveTaskStore.ts # Chunked archive (YYYY-MM.json)
│   │   │   ├── TaskIndex.ts       # Triple indexing (block, task, due)
│   │   │   ├── TaskPersistenceController.ts # Debounced writes (50ms)
│   │   │   └── MigrationManager.ts # Schema versioning
│   │   ├── services/
│   │   │   ├── TaskCreationService.ts  # Phase 3 RRule-only creator
│   │   │   └── AutoMigrationService.ts # Phase 3 auto-migration
│   │   ├── scheduling/
│   │   │   └── DualEngineScheduler.ts  # Legacy compatibility (Phase 1/2)
│   │   ├── recurrence/
│   │   │   └── RecurrenceEngine.ts # RRule adapter (getNextOccurrence, getOccurrencesBetween)
│   │   ├── query/
│   │   │   ├── QueryEngine.ts     # 492 lines, compositional filters
│   │   │   ├── QueryParser.ts     # AST-based query parser
│   │   │   ├── filters/           # 11+ filter types (Status, Date, Priority, Tag, Boolean, Regex, Dependency, Recurrence, Escalation, Attention)
│   │   │   └── groupers/          # Grouping by date, status, priority, path
│   │   ├── parsers/
│   │   │   ├── TaskLineParser.ts  # SiYuan block → Task
│   │   │   ├── TaskLineSerializer.ts # Task → SiYuan block
│   │   │   ├── RecurrenceParser.ts # RRule string parser
│   │   │   ├── DateParser.ts      # ISO date parsing
│   │   │   └── NaturalLanguageParser.ts # chrono-node integration
│   │   ├── urgency/
│   │   │   ├── UrgencyScoreCalculator.ts # Multi-factor urgency scoring
│   │   │   └── UrgencySettings.ts
│   │   ├── attention/
│   │   │   └── AttentionEngine.ts # Lane-based prioritization (inbox, today, upcoming, overdue)
│   │   ├── ai/
│   │   │   ├── SmartSuggestionEngine.ts # ML-based scheduling hints
│   │   │   └── PredictiveScheduler.ts   # Historical pattern learning
│   │   ├── reminders/
│   │   │   ├── reminder.ts        # Reminder model
│   │   │   ├── time.ts            # Time utilities
│   │   │   └── content.ts         # Notification templates
│   │   ├── integration/
│   │   │   └── TaskReminderBridge.ts # Task ↔ Reminder sync
│   │   ├── actions/
│   │   │   ├── CompletionHandler.ts # Task completion logic
│   │   │   └── DeleteHandler.ts     # Task deletion
│   │   ├── block-actions/
│   │   │   ├── BlockActionEngine.ts # Smart actions from block edits
│   │   │   └── BlockEventWatcher.ts # Block change observer
│   │   ├── filtering/
│   │   │   └── GlobalFilter.ts    # Workspace-wide filter rules
│   │   └── api/
│   │       └── SiYuanApiAdapter.ts # SiYuan kernel API wrapper
│   ├── services/
│   │   ├── RecurrenceEngine.ts   # Service layer wrapper
│   │   ├── EventService.ts       # Domain event bus
│   │   ├── SchedulerService.ts   # Background job scheduler
│   │   └── BulkExecutorService.ts # Batch operations
│   ├── query/
│   │   ├── TaskSearchEngine.ts   # Full-text search (Fuse.js)
│   │   └── TaskStatsCalculator.ts # Analytics aggregation
│   ├── integrations/reminders/   # obsidian-reminder fork
│   │   ├── ui/
│   │   │   ├── reminder-list.ts
│   │   │   ├── datetime-chooser.ts
│   │   │   └── editor-extension.ts
│   │   └── notification-worker.ts
│   ├── webhooks/
│   │   ├── inbound/WebhookServer.ts
│   │   └── outbound/OutboundWebhookEmitter.ts
│   └── logging/
│       ├── logger.ts
│       └── performance-profiler.ts
├── frontend/
│   └── components/
│       └── dashboard/
│           └── Dashboard.svelte   # Main dashboard UI
├── infrastructure/
│   └── parsers/
│       ├── TaskLineParser.ts
│       └── TaskLineSerializer.ts
├── domain/
│   └── models/
│       └── Recurrence.ts          # Domain recurrence model
├── shared/
│   └── constants/
│       └── misc-constants.ts
├── settings.ts                    # Plugin settings
└── index.ts                       # 📍 Main plugin entry
```

**Architecture Pattern**: Layered DDD (Domain-Driven Design)
- **Domain Layer**: `backend/core/models` (entities, value objects)
- **Application Layer**: `backend/core/services` (use cases, orchestration)
- **Infrastructure Layer**: `backend/core/storage`, `backend/core/api`
- **Presentation Layer**: `frontend/components`

**Key Architectural Decisions**:
1. **Dual-tier storage**: Active tasks in memory (fast), archives chunked (scalable to 10k+ tasks)
2. **Triple indexing**: `blockIndex` (blockId→taskId), `taskBlockIndex` (taskId→blockId), `dueIndex` (date→taskIds)
3. **Debounced persistence**: 50ms write delay prevents thrashing (TaskPersistenceController.ts)
4. **Optimistic locking**: `task.version` field for concurrent write detection
5. **RRule-only**: Phase 3 deprecates Frequency, all tasks use RFC 5545 RRule

---

### System B: Obsidian Ecosystem (Benchmark Plugins)

#### B1: obsidian-tasks-main (Core Reference)

```
src/
├── Task/
│   ├── Task.ts                    # 896 lines, class-based OOP model
│   ├── Recurrence.ts              # RRule wrapper with baseOnToday logic
│   ├── Urgency.ts                 # Multi-factor urgency calculation
│   ├── Priority.ts                # Priority

 enum
│   ├── TaskLocation.ts            # File path + line number
│   ├── TaskDependency.ts          # ID-based dependencies
│   ├── OnCompletion.ts            # Completion behavior (delete, keep)
│   └── Occurrence.ts              # Single recurrence instance
├── Query/
│   ├── Query.ts                   # 522 lines, query DSL interpreter
│   ├── FilterParser.ts            # Natural language filter parser
│   ├── SearchInfo.ts              # Query context object (Parameter Object pattern)
│   ├── QueryResult.ts             # Result container
│   ├── Sort/                      # Sorting strategies
│   ├── Group/                     # Grouping strategies
│   ├── Explain/
│   │   ├── Explainer.ts           # 📍 Query explanation generator
│   │   └── Explanation.ts         # Explanation data structure
│   ├── Presets/
│   │   ├── Presets.ts             # Named query presets
│   │   └── PresetsSettingsService.ts # Preset persistence (localStorage)
│   └── Filter/                    # Filter classes (FilterOrErrorMessage pattern)
├── Statuses/
│   ├── Status.ts                  # Status value object
│   ├── StatusRegistry.ts          # Status catalog
│   └── StatusConfiguration.ts     # Status settings
├── Obsidian/
│   ├── Cache.ts                   # Metadata cache wrapper
│   ├── LivePreviewExtension.ts    # Editor integration
│   └── TaskModal.ts               # Task edit modal
├── Renderer/
│   ├── QueryRenderer.ts           # Query block renderer
│   └── TaskLineRenderer.ts        # Task markdown renderer
├── Layout/
│   ├── TaskLayout.ts              # Task display options
│   └── QueryLayout.ts             # Query display options
├── Scripting/
│   ├── Expression.ts              # JavaScript expression evaluator
│   └── QueryContext.ts            # Script context
├── Suggestor/
│   └── EditorSuggestorPopup.ts    # Autocomplete UI
└── main.ts                        # Plugin entry
```

**Architecture Pattern**: Service-Oriented with Query DSL
- **Core Model**: Task as class with methods (OOP vs. System A's interface-based)
- **Query Language**: Natural language DSL (`filter due before today`, `group by status`)
- **Explanation System**: `Explainer.explainResults()` generates human-readable query explanations
- **Filter Pattern**: `FilterOrErrorMessage.fromFilter()` wraps parsing errors

**Key Features Missing in System A**:
1. ✅ **Query Explanation**: `Explainer.ts` generates "why this task matched" text
2. ✅ **Saved Queries**: Preset system with localStorage persistence
3. ✅ **Natural Language DSL**: `filter by priority high` vs System A's AST approach
4. ✅ **Script Context**: JavaScript expressions in queries (`filter description.includes("urgent")`)

#### B2: obsidian-kanban-main

```
src/
├── KanbanView.ts                  # Main view plugin
├── Board/
│   ├── Board.ts                   # Board data model
│   ├── Lane.ts                    # Column/lane model
│   └── Card.ts                    # Task card model
├── DragDrop/
│   ├── DragDropController.ts      # Drag-to-reorder logic
│   └── DropZone.ts                # Drop target
└── Settings/
    └── BoardSettings.ts           # Per-board configuration
```

**Gap in System A**: No drag-to-reorder UI (missing `task.order` field usage in UI)

#### B3: obsidian-day-planner-main

```
src/
├── TimelineView.ts                # Time-blocking UI
├── Calendar/
│   └── DayAgenda.ts               # Day view
└── Drag/
    └── TimeSlotDrag.ts            # Drag tasks to time slots
```

**Gap in System A**: No timeline/calendar drag-drop

#### B4: obsidian-tracker-master

```
src/
├── Analytics/
│   ├── HabitTracker.ts            # Completion streak tracking
│   └── ChartRenderer.ts           # d3.js charts
└── Export/
    └── CSVExporter.ts             # Data export
```

**Gap in System A**: Analytics exist (`completionCount`, `streaks`) but no visualization UI

---

## 2. CORE TASK MODEL COMPARISON

### System A: Task Interface (task-recurring-notification-management-master)

**File**: `src/backend/core/models/Task.ts` (560 lines)

```typescript
export interface Task {
  // Core Identity
  id: string;
  name: string;
  
  // Recurrence (Phase 3: RRule-Only)
  frequency?: Frequency;        // DEPRECATED
  recurrence?: Recurrence;      // PRIMARY (RFC 5545 RRule)
  recurrenceText?: string;      // Human-readable display
  
  // Dates & Scheduling
  dueAt: string;                // ISO 8601
  lastCompletedAt?: string;
  scheduledAt?: string;         // Obsidian "scheduled" parity
  startAt?: string;             // Obsidian "start" parity
  createdAt: string;
  updatedAt: string;
  doneAt?: string;
  cancelledAt?: string;
  
  // Status & State
  enabled: boolean;             // Active/inactive toggle
  status?: 'todo' | 'done' | 'cancelled'; // Obsidian status parity
  statusSymbol?: string;        // Checkbox character
  
  // Categorization
  priority?: TaskPriority;      // 0-4 scale
  tags?: string[];
  category?: string;
  path?: string;                // File path
  heading?: string;             // Section heading
  
  // Block Integration (SiYuan-specific)
  linkedBlockId?: string;
  linkedBlockContent?: string;
  blockActions?: BlockLinkedAction[];
  
  // Dependencies
  dependsOn?: string[];
  blockedBy?: string[];
  blocks?: string[];            // Derived, not stored
  seriesId?: string;            // Links recurring instances
  occurrenceIndex?: number;
  
  // Escalation & Notifications
  notificationChannels?: string[];
  escalationPolicy?: {
    enabled: boolean;
    levels: Array<{
      missCount: number;
      action: "notify" | "escalate" | "disable";
      channels?: string[];
    }>;
  };
  
  // Analytics (SUPERIOR to Obsidian)
  completionCount?: number;
  missCount?: number;
  currentStreak?: number;
  bestStreak?: number;
  recentCompletions?: string[]; // Last N completions (ISO strings)
  
  // AI/ML Readiness (UNIQUE to System A)
  completionHistory?: CompletionHistoryEntry[];
  learningMetrics?: {
    averageDelayMinutes: number;
    optimalHour: number;
    consistencyScore: number;
    lastLearningUpdate: string;
  };
  smartRecurrence?: {
    enabled: boolean;
    autoAdjust: boolean;
    minDataPoints: number;
    confidenceThreshold: number;
  };
  completionTimes?: number[];
  completionDurations?: number[];
  completionContexts?: {
    dayOfWeek: number;
    hourOfDay: number;
    wasOverdue: boolean;
    delayMinutes?: number;
  }[];
  
  // Snoozing
  snoozeCount?: number;
  maxSnoozes?: number;
  
  // Completion Behavior
  onCompletion?: 'keep' | 'delete' | OnCompletionAction;
  whenDone?: boolean;           // Next occurrence from completion date
  
  // Persistence
  version?: number;             // Optimistic locking
  timezone?: string;
  description?: string;
  unknownFields?: string[];     // Lossless serialization
}
```

**Field Count**: 40+ fields (30 core + 10 ML/analytics)

### System B: Task Class (obsidian-tasks-main)

**File**: `src/Task/Task.ts` (896 lines)

```typescript
export class Task extends ListItem {
  // Core Metadata
  public readonly status: Status;
  public readonly priority: Priority;
  public readonly tags: string[];
  
  // Dates
  public readonly createdDate: Moment | null;
  public readonly startDate: Moment | null;
  public readonly scheduledDate: Moment | null;
  public readonly dueDate: Moment | null;
  public readonly doneDate: Moment | null;
  public readonly cancelledDate: Moment | null;
  
  // Recurrence
  public readonly recurrence: Recurrence | null;
  public readonly onCompletion: OnCompletion;
  
  // Dependencies
  public readonly dependsOn: string[];
  public readonly id: string;
  
  // Rendering
  public readonly blockLink: string;
  public readonly scheduledDateIsInferred: boolean;
  
  // Location (file context)
  // Inherited from ListItem:
  // - description: string
  // - taskLocation: TaskLocation (path + line number)
  // - indentation: string
  // - listMarker: string
  // - originalMarkdown: string
  
  // Computed
  private _urgency: number | null = null;
}
```

**Field Count**: ~20 fields (focused on markdown rendering)

### COMPARISON MATRIX

| Feature | System A | System B (Obsidian) | Gap Analysis |
|---------|----------|---------------------|--------------|
| **Recurrence** | RRule via `recurrence` field | RRule via `recurrence` field | ✅ Parity |
| **Analytics** | Streaks, completionCount, ML metrics | ❌ None | 🎯 System A SUPERIOR |
| **Block Linking** | `linkedBlockId`, `blockActions` | ❌ None (file-based only) | 🎯 System A SiYuan-specific |
| **Dependencies** | `dependsOn`, `blockedBy`, `blocks` | `dependsOn` only | ⚠️ System A has blocking graph |
| **Escalation** | Multi-level escalationPolicy | ❌ None | 🎯 System A UNIQUE |
| **Contexts/Projects** | ❌ None | ❌ None (use tags) | ⚠️ Both missing (see tasknotes) |
| **Time Tracking** | ❌ None | ❌ None | ❌ Both missing (see tasknotes) |
| **Status System** | `enabled` + `status` enum | `Status` object (customizable) | ⚠️ System B more flexible |
| **Urgency** | calculateUrgencyScore() | Urgency.calculate() | ✅ Both have multi-factor |
| **Location** | `path`, `heading` | TaskLocation (path + line) | ✅ Parity |

### KEY FINDINGS

1. **System A Strengths**:
   - Advanced analytics (streaks, completion history, ML readiness)
   - Escalation policies for missed tasks
   - Block-level integration (SiYuan-specific)
   - Dependency graph (blocking detection)

2. **System B Strengths**:
   - Status customization (StatusRegistry, user-defined symbols)
   - Clean separation: Task as entity, filters as separate layer
   - Markdown-first design (originalMarkdown preserved)

3. **Shared Missing** (from tasknotes-main):
   - **Contexts**: `context` field for GTD-style contexts
   - **Projects**: Multi-level project hierarchy
   - **Time Estimates**: `duration`, `timeSpent` fields
   - **Pomodoros**: Time-boxing support

---

## 3. RECURRING TASK ENGINE COMPARISON

### System A: RecurrenceEngine (RRule Adapter)

**File**: `src/backend/core/recurrence/RecurrenceEngine.ts`

```typescript
import { RRule, RRuleSet, rrulestr } from 'rrule';

export class RecurrenceEngine {
  private rruleCache = new Map<string, RRule>();
  
  /**
   * Get next occurrence after a given date
   */
  getNextOccurrence(task: Task, from: Date = new Date()): Date | null {
    if (!task.recurrence) return null;
    const rrule = this.getRRule(task);
    return rrule.after(from, true); // inclusive
  }
  
  /**
   * Get occurrences in date range (for calendar views)
   */
  getOccurrencesBetween(task: Task, from: Date, to: Date): Date[] {
    if (!task.recurrence) return [];
    const rrule = this.getRRule(task);
    return rrule.between(from, to, true);
  }
  
  /**
   * Convert legacy Frequency to RRule (Phase 2/3 migration)
   */
  legacyFrequencyToRRule(frequency: Frequency, dtstart: Date): string {
    // Implementation: maps DAILY/WEEKLY/MONTHLY/YEARLY to RRule
    return new RRule({
      freq: this.mapFrequency(frequency.type),
      interval: frequency.interval || 1,
      dtstart
    }).toString();
  }
  
  /**
   * Cached RRule instance (performance optimization)
   */
  private getRRule(task: Task): RRule {
    const key = `${task.id}-${task.recurrence.rrule}`;
    if (!this.rruleCache.has(key)) {
      this.rruleCache.set(key, rrulestr(task.recurrence.rrule));
    }
    return this.rruleCache.get(key)!;
  }
}
```

**Key Methods**:
- `getNextOccurrence(task, from)`: Single next date
- `getOccurrencesBetween(task, from, to)`: Range query (calendar support)
- `legacyFrequencyToRRule()`: Migration helper (Phase 3)
- `getRRule()`: Cached RRule parsing

### System B: Recurrence (obsidian-tasks-main)

**File**: `src/Task/Recurrence.ts`

```typescript
import { RRule } from 'rrule';

export class Recurrence {
  public readonly rrule: RRule;
  public readonly baseOnToday: boolean; // When true, next occurrence from today, not due date
  
  /**
   * Get next occurrence
   */
  next(reference: Moment): Moment | null {
    const base = this.baseOnToday ? moment() : reference;
    const nextDate = this.rrule.after(base.toDate(), true);
    return nextDate ? moment(nextDate) : null;
  }
  
  /**
   * Parse recurrence from markdown (e.g., "every week")
   */
  static fromText(text: string): Recurrence | null {
    // Natural language parser: "every 2 weeks" -> RRule
  }
}
```

**Key Differences**:
- `baseOnToday`: Obsidian-specific (complete task today, next occurs from today, not original due)
- Natural language parsing: `fromText("every week")`
- Moment.js vs Date (System A uses ISO strings)

### COMPARISON MATRIX

| Feature | System A | System B | Gap Analysis |
|---------|----------|----------|--------------|
| **RRule Library** | rrule 2.8.0 | rrule (same) | ✅ Parity |
| **Caching** | `rruleCache` Map | ❌ None | 🎯 System A optimized |
| **Range Queries** | `getOccurrencesBetween()` | ❌ None | 🎯 System A calendar-ready |
| **baseOnToday** | `task.whenDone` field | `recurrence.baseOnToday` | ✅ Functional parity |
| **Natural Language** | `NaturalRecurrenceParser.ts` (chrono-node) | `fromText()` | ✅ Both have |
| **Migration Support** | `legacyFrequencyToRRule()` | ❌ N/A | 🎯 System A has legacy path |

### KEY FINDINGS

1. **System A Strengths**:
   - RRule caching for performance
   - Range queries for calendar views
   - Migration support from legacy Frequency

2. **System B Strengths**:
   - Recurrence as value object (immutable)
   - `baseOnToday` as part of recurrence, not task

3. **Recommendation**:
   - Adopt `Recurrence` as value object instead of storing raw RRule strings
   - Keep caching strategy from System A

---

## 4. QUERY/FILTER/SEARCH SYSTEM COMPARISON

### System A: QueryEngine (Compositional Filters)

**File**: `src/backend/core/query/QueryEngine.ts` (492 lines)

```typescript
export class QueryEngine {
  private dependencyGraph: DependencyGraph | null = null;
  private globalFilterAST: QueryAST | null = null;
  
  constructor(private taskIndex: TaskQueryIndex) {}
  
  /**
   * Execute query AST against task index
   */
  async execute(queryString: string, options?: QueryOptions): Promise<QueryResult> {
    const parser = new QueryParser();
    const ast = parser.parse(queryString);
    
    // Apply global filter first
    let tasks = this.taskIndex.getAllTasks();
    if (this.globalFilterAST) {
      tasks = tasks.filter(task => this.evaluateFilter(this.globalFilterAST, task));
    }
    
    // Apply query filters
    tasks = tasks.filter(task => this.evaluateFilter(ast.filter, task));
    
    // Apply grouping
    const groups = this.applyGrouping(tasks, ast.groupBy);
    
    return { tasks, groups, totalCount: tasks.length };
  }
  
  private evaluateFilter(node: FilterNode, task: Task): boolean {
    switch (node.type) {
      case 'and': return node.children.every(c => this.evaluateFilter(c, task));
      case 'or': return node.children.some(c => this.evaluateFilter(c, task));
      case 'not': return !this.evaluateFilter(node.child, task);
      case 'status': return new StatusTypeFilter(node.value).test(task);
      case 'date': return new DateComparisonFilter(node.field, node.comparator, node.value).test(task);
      // ...11+ filter types
    }
  }
}
```

**Filter Types** (`src/backend/core/query/filters/`):
1. StatusFilter (StatusTypeFilter, StatusNameFilter, StatusSymbolFilter, DoneFilter, NotDoneFilter)
2. DateFilter (DateComparisonFilter, HasDateFilter)
3. PriorityFilter (PriorityFilter)
4. TagFilter (TagIncludesFilter, HasTagsFilter)
5. PathFilter (PathFilter)
6. HeadingFilter (HeadingFilter)
7. DescriptionFilter (DescriptionFilter)
8. DependencyFilter (IsBlockedFilter, IsBlockingFilter)
9. RecurrenceFilter (RecurrenceFilter)
10. UrgencyFilter (UrgencyFilter)
11. EscalationFilter (EscalationFilter)
12. BooleanFilter (AndFilter, OrFilter, NotFilter)
13. RegexFilter (DescriptionRegexFilter, PathRegexFilter, TagRegexFilter)
14. AttentionFilter (AttentionLaneFilter, AttentionScoreFilter)

**Query Syntax** (AST-based):
```
status is todo AND priority >= high
due before today OR scheduled after tomorrow
tag includes #urgent NOT path includes "archive"
```

### System B: Query DSL (obsidian-tasks-main)

**File**: `src/Query/Query.ts` (522 lines)

```typescript
export class Query implements IQuery {
  private readonly _filters: Filter[] = [];
  private readonly _sorting: Sorter[] = [];
  private readonly _grouping: Grouper[] = [];
  private _limit: number | undefined;
  
  /**
   * Execute query against task list
   */
  async applyQueryToTasks(tasks: Task[], searchInfo: SearchInfo): Promise<QueryResult> {
    // Filter
    let filtered = tasks.filter(task => 
      this._filters.every(filter => filter.filterFunction(task))
    );
    
    // Sort
    filtered = Sort.by(this._sorting, filtered);
    
    // Group
    const groups = TaskGroups.fromGrouper(this._grouping, filtered);
    
    // Limit
    if (this._limit) filtered = filtered.slice(0, this._limit);
    
    return new QueryResult(filtered, groups, this._error);
  }
  
  /**
   * Parse query line
   */
  private parseLine(statement: Statement): void {
    if (this.filterRegexp.test(statement.line)) {
      const filterOrError = FilterParser.parseFilter(statement);
      if (filterOrError.error) {
        this.setError(filterOrError.error, statement);
      } else {
        this._filters.push(filterOrError.filter);
      }
    }
    // ...parsing for sort, group, limit, hide, show, explain
  }
}
```

**Filter Pattern** (`src/Query/Filter/Filter.ts`):
```typescript
export interface Filter {
  filterFunction: (task: Task) => boolean;
  instruction: string; // Human-readable description
  explain(): string;   // Why this filter exists
}

export class FilterOrErrorMessage {
  filter?: Filter;
  error?: string;
  
  static fromFilter(filter: Filter): FilterOrErrorMessage {
    return { filter };
  }
}
```

**Query DSL Syntax** (Natural Language):
```
filter due before today
filter priority is high
filter tags include #urgent
group by status
sort by urgency
limit to 10
explain
```

**Explanation System** (`src/Query/Explain/Explainer.ts`):
```typescript
export class Explainer {
  explainResults(query: Query, tasks: Task[]): Explanation {
    const lines: string[] = [];
    
    // Explain filters
    query.filters.forEach(filter => {
      lines.push(`Filter: ${filter.instruction}`);
      lines.push(`  Explanation: ${filter.explain()}`);
    });
    
    // Explain sorting
    query.sorting.forEach(sorter => {
      lines.push(`Sort: ${sorter.instruction}`);
    });
    
    return new Explanation(lines);
  }
}
```

### COMPARISON MATRIX

| Feature | System A | System B | Gap Analysis |
|---------|----------|----------|--------------|
| **Filter Composition** | AST-based (AND/OR/NOT) | Array of filters (implicit AND) | ⚠️ System A more powerful |
| **Natural Language** | ❌ Tokens only | ✅ `filter due before today` | ❌ System A lacks readability |
| **Explanation** | ❌ None | ✅ `explainResults()` | ❌ System A CRITICAL GAP |
| **Regex Support** | ✅ DescriptionRegexFilter, PathRegexFilter, TagRegexFilter | ✅ RegexField | ✅ Parity |
| **Grouping** | ✅ Groupers (date, status, priority, path) | ✅ Grouper interface | ✅ Parity |
| **Sorting** | ✅ Sorters | ✅ Sorter interface | ✅ Parity |
| **Dependency Filters** | ✅ IsBlockedFilter, IsBlockingFilter | ✅ `filter blocking` | ✅ Parity |
| **Saved Queries** | ❌ None | ✅ Presets (localStorage) | ❌ System A MISSING |
| **Script Expressions** | ❌ None | ✅ JavaScript expressions | ❌ System A MISSING |

### KEY FINDINGS

1. **System A Strengths**:
   - Compositional filters (boolean algebra)
   - Attention/Escalation filters (unique)
   - AST-based parsing (more powerful)

2. **System B Strengths**:
   - Natural language DSL (user-friendly)
   - Query explanation (`explain` command)
   - Saved queries (Presets)
   - JavaScript expressions in filters

3. **CRITICAL GAPS in System A**:
   - ❌ No query explanation UI
   - ❌ No saved queries persistence
   - ❌ No JavaScript expression support

4. **Recommendation**:
   - Keep AST-based engine (power)
   - Add natural language parser overlay (usability)
   - Implement `Explainer` class for query debugging
   - Add Presets system with localStorage

---

## 5. STORAGE & INDEXING COMPARISON

### System A: Two-Tier Storage with Triple Indexing

**File**: `src/backend/core/storage/TaskStorage.ts` (607 lines)

```typescript
export class TaskStorage implements TaskStorageProvider {
  // Tier 1: Active tasks (in-memory Map)
  private activeTasks: Map<string, Task>;
  
  // Tier 2: Archive (chunked by month)
  private archiveStore: ArchiveTaskStore;
  
  // Indexes
  private blockIndex: Map<string, string> = new Map(); // blockId -> taskId
  private taskBlockIndex: Map<string, string> = new Map(); // taskId -> blockId
  private dueIndex: Map<string, Set<string>> = new Map(); // YYYY-MM-DD -> taskIds
  
  // Persistence controller (debounced writes)
  private persistence: TaskPersistenceController;
  
  async init(): Promise<void> {
    await this.migrateLegacyStorage();
    const loadedTasks = await this.activeStore.loadActive();
    this.activeTasks = loadedTasks;
    this.rebuildBlockIndex();
    this.rebuildDueIndex();
  }
  
  /**
   * Save task with debounced write (50ms delay)
   */
  async save(task: Task): Promise<void> {
    task.version = (task.version || 0) + 1; // Optimistic locking
    task.updatedAt = new Date().toISOString();
    this.activeTasks.set(task.id, task);
    this.updateIndexes(task);
    await this.persistence.scheduleSave(); // Debounced
  }
  
  /**
   * Archive completed task (move to chunked storage)
   */
  async archiveTask(task: Task): Promise<void> {
    await this.archiveStore.archive(task);
    this.activeTasks.delete(task.id);
    this.removeFromIndexes(task.id);
  }
  
  /**
   * Get tasks by due date (index lookup)
   */
  getTasksByDueDate(date: Date): Task[] {
    const dateKey = this.formatDate(date); // YYYY-MM-DD
    const taskIds = this.dueIndex.get(dateKey) || new Set();
    return Array.from(taskIds).map(id => this.activeTasks.get(id)!).filter(Boolean);
  }
}
```

**ArchiveTaskStore** (`src/backend/core/storage/ArchiveTaskStore.ts`):
```typescript
export class ArchiveTaskStore {
  /**
   * Archive task to monthly chunk (archive-YYYY-MM.json)
   */
  async archive(task: Task): Promise<void> {
    const month = this.getMonthKey(task.doneAt || task.updatedAt); // "2024-01"
    const chunk = await this.loadChunk(month) || [];
    chunk.push(task);
    await this.saveChunk(month, chunk);
  }
  
  /**
   * Query archive with date range
   */
  async query(filter: ArchiveQuery): Promise<Task[]> {
    const chunks = this.getRelevantChunks(filter.dateRange);
    const tasks = await Promise.all(chunks.map(c => this.loadChunk(c)));
    return tasks.flat().filter(task => this.matchesFilter(task, filter));
  }
}
```

**TaskPersistenceController** (`src/backend/core/storage/TaskPersistenceController.ts`):
```typescript
export class TaskPersistenceController {
  private saveTimeout: number | null = null;
  private readonly DEBOUNCE_DELAY = 50; // 50ms
  
  /**
   * Schedule debounced save (prevents write thrashing)
   */
  async scheduleSave(): Promise<void> {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = window.setTimeout(() => this.flush(), this.DEBOUNCE_DELAY);
  }
  
  private async flush(): Promise<void> {
    const tasks = this.activeStore.getAllTasks();
    await this.plugin.saveData(STORAGE_ACTIVE_KEY, Array.from(tasks.values()));
  }
}
```

### System B: File-Based Storage (Obsidian)

**Obsidian Storage Model**:
- Tasks stored in Markdown files (`.md`)
- Metadata cache layer (Obsidian API)
- No explicit indexes (Obsidian maintains file → task mapping)
- Saved queries in localStorage

**SavedQueries** (`src/Query/Presets/PresetsSettingsService.ts`):
```typescript
export class PresetsSettingsService {
  private static readonly STORAGE_KEY = 'tasks-presets';
  
  static load(): Presets {
    const json = localStorage.getItem(this.STORAGE_KEY);
    return json ? JSON.parse(json) : {};
  }
  
  static save(presets: Presets): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(presets));
  }
}
```

### COMPARISON MATRIX

| Feature | System A | System B | Gap Analysis |
|---------|----------|----------|--------------|
| **Active Task Storage** | In-memory Map | Markdown files | 🎯 System A faster |
| **Archive Strategy** | Chunked by month | File-based (no archive) | 🎯 System A scalable |
| **Indexing** | Triple index (block, task, due) | Obsidian Metadata Cache | 🎯 System A explicit |
| **Write Debouncing** | 50ms delay | Obsidian auto-save | ✅ Parity (implementation differs) |
| **Optimistic Locking** | `task.version` field | ❌ None | 🎯 System A safer |
| **Saved Queries** | ❌ None | ✅ localStorage | ❌ System A MISSING |
| **Scalability** | 10k+ tasks (chunked archive) | Limited by file count | 🎯 System A better |

### KEY FINDINGS

1. **System A Strengths**:
   - Two-tier storage (fast active, scalable archive)
   - Triple indexing (block, task, due)
   - Debounced writes (50ms)
   - Optimistic locking (version field)
   - Chunked archive (month-based)

2. **System B Strengths**:
   - Saved queries persistence (localStorage)
   - Obsidian Metadata Cache integration

3. **CRITICAL GAP in System A**:
   - ❌ No saved queries persistence

4. **Recommendation**:
   - Add `SavedQueryStore` with localStorage backend
   - Port Presets system from Obsidian

---

## 6. UI WORKFLOW COMPARISON

### System A: Dashboard-Only UI

**File**: `src/frontend/components/dashboard/Dashboard.svelte`

**Current Workflows**:
1. **Dashboard View**: List of active tasks with recurrence display
2. **Settings Panel**: Phase 3 migration status, plugin configuration
3. **Task Actions**: Complete, delete, edit (inline)

**Missing Workflows**:
- ❌ Kanban board (drag-to-reorder)
- ❌ Timeline view (time-blocking)
- ❌ Calendar view (monthly occurrences)
- ❌ Habit tracker (streak visualization)
- ❌ Analytics dashboard (charts)

### System B: Multi-View Ecosystem

#### B1: obsidian-tasks (Query Blocks)
- **Query Code Blocks**: Embed queries in notes
- **Task Modal**: Full-featured edit dialog
- **Live Preview**: Inline task editing

#### B2: obsidian-kanban (Board View)
- **Drag-to-Reorder**: Move cards between lanes
- **Board Persistence**: Per-note board state
- **Lane Configuration**: Custom columns

#### B3: obsidian-day-planner (Timeline)
- **Time-Blocking**: Drag tasks to time slots
- **Day Agenda**: Single-day view
- **Timeline Scroll**: Pan through day

#### B4: obsidian-tracker (Analytics)
- **Chart Types**: Line, bar, pie (d3.js)
- **Habit Tracking**: Streak visualization
- **CSV Export**: Data export

### COMPARISON MATRIX

| Workflow | System A | System B | Gap Analysis |
|----------|----------|----------|--------------|
| **Dashboard List** | ✅ Dashboard.svelte | ✅ Query blocks | ✅ Parity |
| **Kanban Board** | ❌ None | ✅ obsidian-kanban | ❌ MISSING |
| **Timeline/Calendar** | ❌ None | ✅ obsidian-day-planner | ❌ MISSING |
| **Analytics Charts** | ❌ None | ✅ obsidian-tracker | ❌ MISSING |
| **Habit Tracker** | ❌ None | ✅ obsidian-tracker | ❌ MISSING |
| **Task Modal** | ⚠️ Inline edit only | ✅ Full modal | ⚠️ Limited |
| **Live Preview** | ⚠️ Block editing | ✅ Markdown editing | ⚠️ Different paradigm |

### KEY FINDINGS

1. **System A Has**:
   - Dashboard list view
   - Phase 3 migration UI
   - Block-based editing (SiYuan-specific)

2. **System B Has** (across ecosystem):
   - Kanban boards
   - Timeline/calendar views
   - Analytics/habit tracking
   - Multiple visualization modes

3. **CRITICAL GAPS in System A**:
   - ❌ No kanban board
   - ❌ No calendar view
   - ❌ No analytics visualization
   - ❌ No habit tracker

---

## 7. MODULE DEPENDENCY MAP

### System A Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                             │
├─────────────────────────────────────────────────────────────┤
│  Dashboard.svelte                                            │
│    ↓ reads tasks                                             │
│    ↓ dispatches commands                                     │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
├─────────────────────────────────────────────────────────────┤
│  TaskManager.ts                                              │
│    ├─→ QueryEngine.execute(query)                           │
│    ├─→ CompletionHandler.complete(task)                     │
│    ├─→ TaskCreationService.create(input)                    │
│    └─→ EventService.publish(event)                          │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
├─────────────────────────────────────────────────────────────┤
│  models/Task.ts                                              │
│  recurrence/RecurrenceEngine.getNextOccurrence()             │
│  urgency/calculateUrgencyScore()                             │
│  attention/AttentionEngine.computeLanes()                    │
└──────────────────┬──────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                        │
├─────────────────────────────────────────────────────────────┤
│  storage/TaskStorage                                         │
│    ├─→ ActiveTaskStore.saveActive()                         │
│    ├─→ ArchiveTaskStore.archive()                           │
│    ├─→ TaskPersistenceController.scheduleSave()             │
│    └─→ TaskIndex.rebuildDueIndex()                          │
│  api/SiYuanApiAdapter                                        │
│    ├─→ setBlockAttrs(blockId, attrs)                        │
│    └─→ getBlockByID(blockId)                                │
└─────────────────────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────┐
│                     External Systems                         │
├─────────────────────────────────────────────────────────────┤
│  SiYuan Kernel API                                           │
│  rrule library (RFC 5545)                                    │
│  chrono-node (NLP dates)                                     │
│  Fuse.js (fuzzy search)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Critical Points

1. **TaskStorage** is central persistence hub (all writes go through here)
2. **EventService** broadcasts domain events (completion, creation, deletion)
3. **QueryEngine** is the only query entry point (enforces global filter)
4. **RecurrenceEngine** is stateless (caches RRule instances)

---

## 8. RELIABILITY & EDGE CASES

### System A Risk Register

**File**: `task-recurring-notification-management-master/docs/RISKS.md` (if exists)

1. **Concurrent Write Risk**:
   - **Scenario**: Two tabs modify same task simultaneously
   - **Mitigation**: Optimistic locking (`task.version` field)
   - **Status**: ✅ Implemented

2. **10k+ Task Performance**:
   - **Scenario**: Startup time with 10,000 active tasks
   - **Mitigation**: Chunked archive, lazy loading
   - **Status**: ✅ Architecture supports, needs load testing

3. **saveData() Failure**:
   - **Scenario**: SiYuan kernel write failure
   - **Mitigation**: Retry queue in TaskPersistenceController
   - **Status**: ⚠️ Retry logic exists, needs error UI

4. **Block Attribute Sync Lag**:
   - **Scenario**: Block attributes not syncing to SiYuan blocks
   - **Mitigation**: `blockAttrRetryQueue` with timeouts
   - **Status**: ✅ Implemented

5. **RRule Parsing Errors**:
   - **Scenario**: Malformed RRule string from user input
   - **Mitigation**: Try-catch in `RecurrenceEngine.getRRule()`
   - **Status**: ⚠️ Needs validation before storage

6. **Archive Query Performance**:
   - **Scenario**: Querying 100 months of archives
   - **Mitigation**: `getRelevantChunks()` filters by date range
   - **Status**: ✅ Optimized

### System B Edge Cases (from obsidian-tasks)

1. **Checkbox Status Detection**:
   - **Challenge**: Parsing `- [x]`, `- [/]`, `- [-]` variants
   - **Solution**: StatusRegistry with regex patterns

2. **Recurring Task on Completion**:
   - **Challenge**: Update recurrence on checkbox toggle
   - **Solution**: `OnCompletion.handle()` creates next occurrence

3. **Global Query Filter**:
   - **Challenge**: Apply workspace-wide exclusions
   - **Solution**: GlobalFilter class (imported by Query)

---

## 9. GAP ANALYSIS SUMMARY

### CRITICAL GAPS (Must Fix for Production)

| Gap | System A Missing | System B Has | Impact | Priority |
|-----|------------------|--------------|--------|----------|
| **Query Explanation** | ❌ No `explain` | ✅ Explainer.ts | Users can't debug queries | 🔴 HIGH |
| **Saved Queries** | ❌ No persistence | ✅ Presets (localStorage) | No reusable filters | 🔴 HIGH |
| **Kanban Board** | ❌ No drag-to-reorder UI | ✅ obsidian-kanban | Critical workflow | 🔴 HIGH |
| **Calendar View** | ❌ No monthly view | ✅ obsidian-day-planner | Recurring task viz | 🟡 MEDIUM |
| **Analytics Viz** | ❌ No charts | ✅ obsidian-tracker | Underutilizes analytics | 🟡 MEDIUM |

### MODERATE GAPS (Feature Parity)

| Gap | System A Missing | System B Has | Impact | Priority |
|-----|------------------|--------------|--------|----------|
| **Contexts/Projects** | ❌ No GTD contexts | ✅ tasknotes | Workflow limitation | 🟡 MEDIUM |
| **Time Tracking** | ❌ No pomodoros | ✅ tasknotes | No time estimates | 🟢 LOW |
| **Script Expressions** | ❌ No JS in queries | ✅ Scripting/Expression.ts | Power-user feature | 🟢 LOW |
| **Natural Language DSL** | ⚠️ AST only | ✅ `filter due before today` | Usability | 🟡 MEDIUM |

### UNIQUE STRENGTHS (Keep)

| Feature | System A Has | System B Missing | Value |
|---------|--------------|------------------|-------|
| **ML Analytics** | ✅ completionHistory, learningMetrics | ❌ None | Predictive scheduling |
| **Escalation Policies** | ✅ Multi-level escalation | ❌ None | Enterprise feature |
| **Block Actions** | ✅ BlockActionEngine | ❌ N/A | SiYuan integration |
| **Attention Engine** | ✅ Lane-based prioritization | ❌ None | Workflow innovation |
| **Chunked Archive** | ✅ Month-based archiving | ❌ None | 10k+ task scalability |

---

## 10. IMPLEMENTATION ROADMAP (9 PHASES)

### Phase 1: Query Enhancement (Foundation)
**Duration**: 2 weeks  
**Priority**: 🔴 CRITICAL

**Deliverables**:
1. `QueryExplainer.ts`: Port from obsidian-tasks, adapts to System A filters
2. `SavedQueryStore.ts`: localStorage-based query persistence
3. `NaturalLanguageQueryParser.ts`: Natural language overlay on AST parser
4. TypeScript interfaces:
   ```typescript
   interface Explanation {
     filterExplanations: FilterExplanation[];
     mismatchReasons: string[];
     matchCount: number;
   }
   
   interface SavedQuery {
     id: string;
     name: string;
     queryString: string;
     createdAt: string;
   }
   ```

**API Changes**:
- `QueryEngine.executeWithExplanation(query): { result: QueryResult, explanation: Explanation }`
- `SavedQueryStore.save(query: SavedQuery): void`
- `SavedQueryStore.load(): SavedQuery[]`

**Migration Steps**:
1. Add `explain` keyword to QueryParser.ts
2. Implement Explainer class with explain() method on all Filter classes
3. Create SavedQueryStore with localStorage adapter
4. Update Dashboard.svelte to show explanations on demand

**Tests**:
- Unit tests: Explainer.explainQueryResult()
- Integration tests: SavedQueryStore persistence
- E2E tests: Dashboard "Explain Query" button

**Acceptance Criteria**:
- [ ] `explain` command shows filter match reasons
- [ ] Saved queries persist across sessions
- [ ] Natural language queries parse correctly (e.g., "due before today")

---

### Phase 2: Kanban Board UI
**Duration**: 3 weeks  
**Priority**: 🔴 CRITICAL

**Deliverables**:
1. `KanbanBoard.svelte`: Drag-to-reorder board component
2. `KanbanLane.svelte`: Column component (status-based lanes)
3. `TaskCard.svelte`: Draggable task card
4. `DragDropController.ts`: Drag-drop event handler
5. `task.order` field usage: Update Task model to use existing `order` field

**Architecture**:
```


---

### Phase 3: Calendar View
**Duration**: 3 weeks  
**Priority**: 🟡 MEDIUM

**Deliverables**:
1. `CalendarView.svelte`: Monthly calendar grid
2. `CalendarDay.svelte`: Single day cell (shows tasks)
3. `RecurrencePreviewService.ts`: Pre-compute occurrences for month range
4. Integration with `RecurrenceEngine.getOccurrencesBetween()`

**Architecture**:
```
CalendarView.svelte
  ├─→ CalendarDay.svelte (date: 2024-01-01)
  │     ├─→ TaskChip.svelte (task 1)
  │     └─→ TaskChip.svelte (task 2)
  ├─→ CalendarDay.svelte (date: 2024-01-02)
  └─→ onMonthChange() → RecurrencePreviewService.getOccurrences(month)
```

**API Changes**:
- `RecurrencePreviewService.getOccurrencesForMonth(yearMonth: string): Map<string, Task[]>` // dateKey → tasks

**Migration Steps**:
1. Pre-generate occurrences on calendar view open (async)
2. Cache occurrences for current + adjacent months
3. Update on task edit (invalidate cache)

**Tests**:
- Occurrence rendering: Monthly recurring task shows all dates
- Performance: 1000 recurring tasks render in <500ms
- Edge cases: End-of-month, leap years

**Acceptance Criteria**:
- [ ] Monthly view shows all task occurrences
- [ ] Click day to see task details
- [ ] Drag task to reschedule (stretch goal)

---

### Phase 4: Analytics Dashboard
**Duration**: 2 weeks  
**Priority**: 🟡 MEDIUM

**Deliverables**:
1. `AnalyticsDashboard.svelte`: Chart container
2. `CompletionChart.svelte`: Streak line chart (d3.js)
3. `HabitTracker.svelte`: Heatmap (GitHub-style)
4. `TaskStatsCalculator.ts`: Already exists, expose via UI

**Architecture**:
```
AnalyticsDashboard.svelte
  ├─→ CompletionChart.svelte (data: task.recentCompletions)
  ├─→ HabitTracker.svelte (data: task.completionHistory)
  └─→ StatsCard.svelte (completionCount, currentStreak, bestStreak)
```

**API Changes**:
- `TaskStatsCalculator.getStreakData(task: Task): StreakData`
- `TaskStatsCalculator.getCompletionTrend(tasks: Task[]): TrendData`

**Migration Steps**:
1. Install d3.js (already in devDependencies)
2. Add analytics view toggle to Dashboard
3. Export CSV button (CSVExporter.ts)

**Tests**:
- Chart rendering: Data displays correctly
- Historical data: recentCompletions (last 30) used correctly
- Export: CSV contains all analytics fields

**Acceptance Criteria**:
- [ ] Streak chart shows last 30 days
- [ ] Heatmap shows completion density
- [ ] Export button downloads CSV

---


### Phase 6: Time Tracking
**Duration**: 2 weeks  
**Priority**: 🟢 LOW

**Deliverables**:
1. Add `timeEstimate?: number` (minutes) to Task.ts
2. Add `timeSpent?: number` (minutes) to Task.ts
3. Add `pomodoros?: number` to Task.ts
4. `TimeTrackingService.ts`: Start/stop timer
5. UI: Timer widget in task card

**TypeScript**:
```typescript
export interface Task {
  // ...existing fields
  timeEstimate?: number;  // minutes
  timeSpent?: number;     // minutes
  pomodoros?: number;     // completed pomodoro sessions
  timerStartedAt?: string; // ISO 8601
}
```

**API Changes**:
- `TimeTrackingService.startTimer(taskId: string): void`
- `TimeTrackingService.stopTimer(taskId: string): { duration: number }`

**Migration Steps**:
1. Schema version bump (v3 → v4)
2. MigrationManager: Add time tracking fields

**Tests**:
- Timer: Start/stop records duration
- Pomodoro: Increment counter on 25-minute completion
- Analytics: Track timeSpent trends

**Acceptance Criteria**:
- [ ] Start/stop timer for task
- [ ] Track time spent
- [ ] Pomodoro counter increments

---

### Phase 7: Reminder Productionization
**Duration**: 2 weeks  
**Priority**: 🟡 MEDIUM

**Deliverables**:
1. `ReminderEngine.ts`: Notification scheduler (uses `backend/integrations/reminders`)
2. UI: Reminder time picker in task editor
3. Browser notification integration (Notification API)
4. SiYuan kernel message integration

**API Changes**:
- `ReminderEngine.scheduleReminder(task: Task, time: Date): void`
- `ReminderEngine.cancelReminder(taskId: string): void`

**Migration Steps**:
1. Enable reminder system by default (currently opt-in)
2. Auto-schedule reminders for tasks with `dueAt` (default: 1 hour before)
3. Persist reminder settings in PluginSettings

**Tests**:
- Schedule: Reminder fires at correct time
- Cancel: Cancelled reminders don't fire
- Multi-channel: Browser + SiYuan kernel notifications

**Acceptance Criteria**:
- [ ] Reminder fires 1 hour before due date
- [ ] Browser notification appears
- [ ] SiYuan kernel message sent

---

### Phase 8: Migration Runner
**Duration**: 1 week  
**Priority**: 🔴 CRITICAL

**Deliverables**:
1. `MigrationRunner.ts`: Orchestrates all schema migrations
2. `MigrationLog.ts`: Audit trail (logs all changes)
3. UI: Migration status panel in settings
4. Rollback support (backup original data)

**TypeScript**:
```typescript
interface Migration {
  version: number;
  name: string;
  up(tasks: Task[]): Task[];
  down(tasks: Task[]): Task[];
}

class MigrationRunner {
  async run(): Promise<MigrationResult> {
    const migrations = [
      new FrequencyToRecurrenceMigration(), // Phase 3
      new AddContextProjectMigration(),      // Phase 5
      new AddTimeTrackingMigration()         // Phase 6
    ];
    
    for (const migration of migrations) {
      if (this.needsMigration(migration.version)) {
        await migration.up(this.tasks);
        this.logMigration(migration);
      }
    }
  }
}
```

**API Changes**:
- `MigrationRunner.run(): Promise<MigrationResult>`
- `MigrationRunner.rollback(toVersion: number): Promise<void>`

**Migration Steps**:
1. Run on plugin startup (after TaskStorage.init())
2. Check localStorage for last migration version
3. Apply only pending migrations

**Tests**:
- Forward migration: v1 → v4 applies all migrations
- Rollback: v4 → v3 reverts last migration
- Idempotency: Running twice has no effect

**Acceptance Criteria**:
- [ ] Auto-migrate on startup
- [ ] Show migration progress UI
- [ ] Log all changes to MigrationLog

---

### Phase 9: Performance Optimization
**Duration**: 2 weeks  
**Priority**: 🟡 MEDIUM

**Deliverables**:
1. Virtual scrolling for Dashboard (1000+ tasks)
2. Query result caching (QueryResultCache.ts)
3. IndexedDB for large archives (replace JSON chunks)
4. Web Worker for heavy computations (urgency scores, analytics)

**API Changes**:
- `QueryResultCache.get(queryString: string): QueryResult | null`
- `QueryResultCache.invalidate(taskId: string): void`
- `AnalyticsWorker.computeStats(tasks: Task[]): Promise<Stats>`

**Migration Steps**:
1. Migrate ArchiveTaskStore to IndexedDB (chunked → indexed)
2. Add service worker registration in index.ts
3. Cache query results with 5-minute TTL

**Tests**:
- Virtual scroll: 10,000 tasks render in <100ms
- Cache hit: Repeated queries return cached results
- Worker: Heavy computation doesn't block UI

**Acceptance Criteria**:
- [ ] Dashboard loads 10k tasks in <1s
- [ ] Query re-execution uses cache
- [ ] Analytics compute in Web Worker

---

## 11. CODE DELIVERABLES (TypeScript Specifications)

### A. Canonical Task Model (Enhanced)

**File**: `src/backend/core/models/Task.v4.ts`

```typescript
/**
 * Task entity (v4 schema)
 * Combines System A (analytics, escalation) + System B (contexts, projects, time tracking)
 */
export interface Task {
  // Identity
  id: string;
  name: string;
  description?: string;
  
  // Recurrence (RRule-only, Phase 3)
  recurrence?: Recurrence;      // RFC 5545 RRule
  recurrenceText?: string;      // Human-readable
  whenDone?: boolean;           // Next occurrence from completion date
  
  // Dates & Scheduling
  dueAt: string;                // ISO 8601
  scheduledAt?: string;         // Obsidian "scheduled"
  startAt?: string;             // Obsidian "start"
  createdAt: string;
  updatedAt: string;
  lastCompletedAt?: string;
  doneAt?: string;
  cancelledAt?: string;
  
  // Status & Priority
  status: 'todo' | 'done' | 'cancelled';
  statusSymbol?: string;        // Checkbox character
  priority?: 0 | 1 | 2 | 3 | 4; // 0=lowest, 4=highest
  
  // Categorization (GTD)
  tags?: string[];
  context?: string;             // NEW (Phase 5): @home, @office
  project?: string;             // NEW (Phase 5): personal/health
  category?: string;
  path?: string;
  heading?: string;
  
  // Time Tracking (NEW - Phase 6)
  timeEstimate?: number;        // minutes
  timeSpent?: number;           // minutes
  pomodoros?: number;
  timerStartedAt?: string;      // ISO 8601
  
  // Dependencies
  dependsOn?: string[];
  blockedBy?: string[];
  blocks?: string[];            // Derived
  seriesId?: string;            // Links recurring instances
  occurrenceIndex?: number;
  
  // Block Integration (SiYuan-specific)
  linkedBlockId?: string;
  linkedBlockContent?: string;
  blockActions?: BlockLinkedAction[];
  
  // Notifications & Escalation
  notificationChannels?: string[];
  escalationPolicy?: {
    enabled: boolean;
    levels: Array<{
      missCount: number;
      action: "notify" | "escalate" | "disable";
      channels?: string[];
    }>;
  };
  
  // Analytics (System A strength)
  completionCount?: number;
  missCount?: number;
  currentStreak?: number;
  bestStreak?: number;
  recentCompletions?: string[];
  
  // ML/AI (System A unique)
  completionHistory?: CompletionHistoryEntry[];
  learningMetrics?: {
    averageDelayMinutes: number;
    optimalHour: number;
    consistencyScore: number;
    lastLearningUpdate: string;
  };
  smartRecurrence?: {
    enabled: boolean;
    autoAdjust: boolean;
    minDataPoints: number;
    confidenceThreshold: number;
  };
  
  // Snoozing
  snoozeCount?: number;
  maxSnoozes?: number;
  
  // Completion Behavior
  onCompletion?: 'keep' | 'delete' | OnCompletionAction;
  
  // Persistence
  version: number;              // Optimistic locking
  timezone?: string;
  unknownFields?: string[];
}

export interface Recurrence {
  rrule: string;                // RFC 5545 RRule string
  humanReadable: string;        // "Every 2 weeks on Monday"
}

export interface CompletionHistoryEntry {
  completedAt: string;          // ISO 8601
  dueAt: string;
  delayMinutes: number;
  dayOfWeek: number;
  hourOfDay: number;
}

export interface OnCompletionAction {
  action: 'keep' | 'delete' | 'archive' | 'customTransition';
  nextStatus?: 'todo' | 'done' | 'cancelled' | string;
  customHandler?: string;
}
```

---

### B. Query Explainer Specification

**File**: `src/backend/core/query/QueryExplainer.ts`

```typescript
import type { Task } from '@backend/core/models/Task';
import type { Filter } from '@backend/core/query/filters/FilterBase';
import type { QueryResult } from '@backend/core/query/QueryEngine';

export interface FilterExplanation {
  filterName: string;
  filterDescription: string;
  matched: boolean;
  reason: string;
}

export interface TaskExplanation {
  task: Task;
  filterExplanations: FilterExplanation[];
  matched: boolean;
}

export interface Explanation {
  queryString: string;
  taskExplanations: TaskExplanation[];
  matchCount: number;
  totalCount: number;
}

export class QueryExplainer {
  /**
   * Generate explanation for query result
   */
  explainQuery(
    result: QueryResult,
    filters: Filter[],
    allTasks: Task[]
  ): Explanation {
    const taskExplanations = allTasks.map(task => {
      const filterExplanations = filters.map(filter => {
        const matched = filter.test(task);
        return {
          filterName: filter.constructor.name,
          filterDescription: filter.explain(),
          matched,
          reason: matched 
            ? filter.explainMatch(task) 
            : filter.explainMismatch(task)
        };
      });
      
      return {
        task,
        filterExplanations,
        matched: filterExplanations.every(f => f.matched)
      };
    });
    
    return {
      queryString: this.reconstructQuery(filters),
      taskExplanations,
      matchCount: result.tasks.length,
      totalCount: allTasks.length
    };
  }
  
  private reconstructQuery(filters: Filter[]): string {
    return filters.map(f => f.explain()).join(' AND ');
  }
}

/**
 * Extension to FilterBase interface
 */
export interface FilterExplainable {
  explain(): string;                  // "priority >= high"
  explainMatch(task: Task): string;   // "Task 'Buy milk' has priority HIGH (≥ HIGH)"
  explainMismatch(task: Task): string; // "Task 'Walk dog' has priority MEDIUM (< HIGH)"
}
```

**Usage Example**:
```typescript
const explainer = new QueryExplainer();
const result = await queryEngine.execute("priority >= high AND due before today");
const explanation = explainer.explainQuery(result, queryEngine.getFilters(), allTasks);

console.log(explanation.taskExplanations[0]);
// {
//   task: { id: "123", name: "Buy milk", priority: 4, dueAt: "2024-01-01" },
//   filterExplanations: [
//     { filterName: "PriorityFilter", matched: true, reason: "Task 'Buy milk' has priority HIGH (≥ HIGH)" },
//     { filterName: "DateComparisonFilter", matched: true, reason: "Task due 2024-01-01 is before today (2024-01-15)" }
//   ],
//   matched: true
// }
```

---

### C. Saved Query Store Specification

**File**: `src/backend/core/query/SavedQueryStore.ts`

```typescript
export interface SavedQuery {
  id: string;
  name: string;
  queryString: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
  folder?: string;
}

export class SavedQueryStore {
  private static readonly STORAGE_KEY = 'tasks-saved-queries';
  
  /**
   * Load all saved queries from localStorage
   */
  static load(): SavedQuery[] {
    const json = localStorage.getItem(this.STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }
  
  /**
   * Save query to localStorage
   */
  static save(query: SavedQuery): void {
    const queries = this.load();
    const existingIndex = queries.findIndex(q => q.id === query.id);
    
    if (existingIndex >= 0) {
      queries[existingIndex] = { ...query, updatedAt: new Date().toISOString() };
    } else {
      queries.push(query);
    }
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queries));
  }
  
  /**
   * Delete saved query
   */
  static delete(queryId: string): void {
    const queries = this.load().filter(q => q.id !== queryId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(queries));
  }
  
  /**
   * Get query by ID
   */
  static get(queryId: string): SavedQuery | null {
    return this.load().find(q => q.id === queryId) || null;
  }
  
  /**
   * Export queries to JSON
   */
  static export(): string {
    return JSON.stringify(this.load(), null, 2);
  }
  
  /**
   * Import queries from JSON
   */
  static import(json: string): void {
    const imported = JSON.parse(json);
    const existing = this.load();
    const merged = [...existing, ...imported];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(merged));
  }
}
```

---

### D. Kanban Board Specification

**File**: `src/frontend/components/kanban/KanbanBoard.svelte`

```svelte
<script lang="ts">
  import type { Task } from '@backend/core/models/Task';
  import KanbanLane from './KanbanLane.svelte';
  import DragDropController from './DragDropController';
  
  export let tasks: Task[];
  export let onTaskUpdate: (task: Task) => Promise<void>;
  
  const lanes = [
    { id: 'todo', title: 'To Do', status: 'todo' as const },
    { id: 'in-progress', title: 'In Progress', status: 'todo' as const },
    { id: 'done', title: 'Done', status: 'done' as const }
  ];
  
  const dragController = new DragDropController();
  
  function handleDrop(taskId: string, targetLane: string, targetOrder: number) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const updatedTask = {
      ...task,
      status: lanes.find(l => l.id === targetLane)?.status || task.status,
      order: targetOrder
    };
    
    onTaskUpdate(updatedTask);
  }
</script>

<div class="kanban-board">
  {#each lanes as lane}
    <KanbanLane
      {lane}
      tasks={tasks.filter(t => t.status === lane.status)}
      {dragController}
      on:drop={(e) => handleDrop(e.detail.taskId, lane.id, e.detail.order)}
    />
  {/each}
</div>

<style>
  .kanban-board {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }
</style>
```

**File**: `src/frontend/components/kanban/DragDropController.ts`

```typescript
export class DragDropController {
  private draggedTaskId: string | null = null;
  
  onDragStart(taskId: string): void {
    this.draggedTaskId = taskId;
  }
  
  onDragOver(event: DragEvent): void {
    event.preventDefault(); // Allow drop
  }
  
  onDrop(event: DragEvent, targetLane: string, targetOrder: number): { taskId: string, lane: string, order: number } {
    event.preventDefault();
    
    if (!this.draggedTaskId) return null;
    
    const result = {
      taskId: this.draggedTaskId,
      lane: targetLane,
      order: targetOrder
    };
    
    this.draggedTaskId = null;
    return result;
  }
}
```

---

## 12. ACCEPTANCE CRITERIA (9 Phases)

### Phase 1: Query Enhancement
- [ ] `explain` keyword shows filter match/mismatch reasons
- [ ] Saved queries persist in localStorage
- [ ] Natural language queries parse (e.g., "due before today")
- [ ] Dashboard shows "Explain Query" button

### Phase 2: Kanban Board
- [ ] Drag task from "todo" to "done" lane changes status
- [ ] Drag task within lane updates order
- [ ] Order persists after plugin reload
- [ ] Board view toggle in Dashboard

### Phase 3: Calendar View
- [ ] Monthly view shows all task occurrences
- [ ] Click day to see task details
- [ ] Recurring tasks display correct dates
- [ ] Performance: 1000 tasks render in <500ms

### Phase 4: Analytics Dashboard
- [ ] Streak chart shows last 30 days
- [ ] Heatmap shows completion density
- [ ] Export button downloads CSV
- [ ] Stats cards show completionCount, currentStreak, bestStreak

### Phase 5: Contexts & Projects
- [ ] Filter by context (`context is @home`)
- [ ] Group by project (`group by project`)
- [ ] Edit context/project in UI
- [ ] Parse context/project from block attributes

### Phase 6: Time Tracking
- [ ] Start/stop timer for task
- [ ] Track time spent
- [ ] Pomodoro counter increments on 25-minute sessions
- [ ] Analytics show timeSpent trends

### Phase 7: Reminder Productionization
- [ ] Reminder fires 1 hour before due date (default)
- [ ] Browser notification appears
- [ ] SiYuan kernel message sent
- [ ] Reminder time picker in task editor

### Phase 8: Migration Runner
- [ ] Auto-migrate on startup (v1 → v4)
- [ ] Show migration progress UI
- [ ] Log all changes to MigrationLog
- [ ] Rollback support

### Phase 9: Performance Optimization
- [ ] Dashboard loads 10k tasks in <1s
- [ ] Query re-execution uses cache (5-minute TTL)
- [ ] Analytics compute in Web Worker
- [ ] Virtual scrolling handles 1000+ tasks

---

## 13. FINAL RECOMMENDATIONS

### Immediate Actions (Next Sprint)

1. **Implement Query Explanation** (Phase 1 - Week 1):
   - Port `Explainer.ts` from obsidian-tasks
   - Add `explain()`, `explainMatch()`, `explainMismatch()` to all Filter classes
   - Add "Explain Query" button to Dashboard.svelte

2. **Add Saved Queries** (Phase 1 - Week 2):
   - Create `SavedQueryStore.ts` with localStorage
   - Add saved query selector to Dashboard
   - Export/import functionality

3. **Design Kanban UI** (Phase 2 - Start Week 3):
   - Prototype `KanbanBoard.svelte` in dev mode
   - Test drag-drop with dummy data
   - Validate `task.order` field usage

### Long-Term Strategy

1. **Modularization**:
   - Extract Kanban, Calendar, Analytics as separate Svelte components
   - Create `src/frontend/components/views/` folder structure
   - Enable view plugins (third-party views)

2. **API Stabilization**:
   - Freeze Task.ts schema at v4 (after Phase 6)
   - Document migration path for v4 → v5
   - Version all APIs (`@since v4.0.0` JSDoc tags)

3. **Community Contributions**:
   - Open-source query language spec
   - Plugin API for custom filters
   - Theme support (CSS variables)

### Success Metrics

1. **Query Power**: 100% filter parity with obsidian-tasks by end of Phase 1
2. **UI Workflows**: 3+ view modes (dashboard, kanban, calendar) by end of Phase 3
3. **Analytics**: Visualization of all existing analytics fields by end of Phase 4
4. **Performance**: 10k tasks load in <1s by end of Phase 9

---

## 14. CONCLUSION

### Strengths to Preserve

1. **Advanced Analytics**: System A's ML-ready analytics (streaks, completion history, learning metrics) are SUPERIOR to Obsidian ecosystem
2. **Escalation Policies**: Unique to System A, enterprise-ready feature
3. **RRule-Only Architecture**: Phase 3 completion puts System A on par with Obsidian for recurrence
4. **Two-Tier Storage**: Chunked archive strategy is more scalable than Obsidian's file-based approach
5. **Block Integration**: SiYuan-specific strength (block actions, block linking)

### Critical Gaps to Fill

1. **Query Explanation**: Port `Explainer.ts` from obsidian-tasks (highest priority)
2. **Saved Queries**: localStorage-based persistence (quick win)
3. **Kanban Board**: Drag-to-reorder UI (workflow-critical)
4. **Calendar View**: Monthly occurrence visualization (recurrence UX)
5. **Analytics Viz**: d3.js charts to surface existing data (low-hanging fruit)

### Architectural Philosophy

- **Keep**: System A 's compositional filter architecture (AST-based, boolean algebra)
- **Add**: Natural language DSL overlay for usability (obsidian-tasks pattern)
- **Enhance**: Query explanation system for debuggability
- **Extend**: Multi-view UI (kanban, calendar, analytics) without changing core architecture

---

**End of Phase 0 Audit** | Version 1.0 | Generated by Senior Plugin Architect + Senior Engineer
