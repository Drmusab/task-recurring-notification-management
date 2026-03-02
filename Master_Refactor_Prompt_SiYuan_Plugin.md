# 🔥 MASTER GLOBAL REFACTOR PROMPT

## For AI Coding Agents — SiYuan Plugin Architecture Guide

**Plugin:** `task-recurring-notification-management`

**Target:** Runtime-Safe • Lifecycle-Aware • SiYuan-Native • Event-Driven • DTO-Isolated • Domain-Immutable

---

## Table of Contents

- [🔥 MASTER GLOBAL REFACTOR PROMPT](#-master-global-refactor-prompt)
  - [For AI Coding Agents — SiYuan Plugin Architecture Guide](#for-ai-coding-agents--siyuan-plugin-architecture-guide)
  - [Table of Contents](#table-of-contents)
  - [1. Agent Role Definition](#1-agent-role-definition)
    - [1.1 Your Identity](#11-your-identity)
    - [1.2 Your Mission](#12-your-mission)
  - [2. Target System Architecture](#2-target-system-architecture)
    - [2.1 Directory Structure](#21-directory-structure)
  - [3. Core Architecture Rules](#3-core-architecture-rules)
    - [3.1 Domain Layer - Immutable Runtime Truth](#31-domain-layer---immutable-runtime-truth)
      - [Task Entity Requirements](#task-entity-requirements)
      - [Domain Layer Structure](#domain-layer-structure)
    - [3.2 Application/Services Layer - Single Mutation Authority](#32-applicationservices-layer---single-mutation-authority)
      - [Authorized TaskService Methods](#authorized-taskservice-methods)
      - [TaskService Implementation Pattern](#taskservice-implementation-pattern)
    - [3.3 Infrastructure Layer - SiYuan API Adapter](#33-infrastructure-layer---siyuan-api-adapter)
      - [Required SiYuan API Endpoints](#required-siyuan-api-endpoints)
      - [Infrastructure Adapter Pattern](#infrastructure-adapter-pattern)
    - [3.4 Runtime Layer - Execution Pipeline](#34-runtime-layer---execution-pipeline)
      - [Execution Pipeline Sequence](#execution-pipeline-sequence)
      - [Pipeline Implementation Pattern](#pipeline-implementation-pattern)
  - [4. Specialized Layer Rules](#4-specialized-layer-rules)
    - [4.1 Query Layer - Read-Only Data Access](#41-query-layer---read-only-data-access)
      - [Query Rules](#query-rules)
    - [4.2 Cache Layer - In-Memory State](#42-cache-layer---in-memory-state)
      - [Cache Invalidation Triggers](#cache-invalidation-triggers)
    - [4.3 Dependency Layer - Execution Guard](#43-dependency-layer---execution-guard)
      - [Dependency Rules](#dependency-rules)
    - [4.4 Reminder Layer - Notification Dispatch](#44-reminder-layer---notification-dispatch)
      - [Reminder Rules](#reminder-rules)
      - [Retry Validation Requirements](#retry-validation-requirements)
    - [4.5 Integration Layer - Webhook Dispatch](#45-integration-layer---webhook-dispatch)
      - [Integration Rules](#integration-rules)
    - [4.6 AI/ML Layer - Smart Suggestions](#46-aiml-layer---smart-suggestions)
      - [AI Trigger Events](#ai-trigger-events)
  - [5. Frontend Architecture Rules](#5-frontend-architecture-rules)
    - [Frontend Requirements](#frontend-requirements)
    - [Frontend Forbidden Actions](#frontend-forbidden-actions)
  - [6. Mount Layer - Boot Sequence](#6-mount-layer---boot-sequence)
    - [Required Boot Sequence](#required-boot-sequence)
  - [7. Event Flow Specification](#7-event-flow-specification)
    - [Required Domain Events](#required-domain-events)
  - [8. Global Forbidden Actions](#8-global-forbidden-actions)
    - [Universal Prohibitions](#universal-prohibitions)
  - [9. Post-Refactor Validation Checklist](#9-post-refactor-validation-checklist)
    - [Validation Test Cases](#validation-test-cases)
  - [10. Expected Output Artifacts](#10-expected-output-artifacts)
    - [Required Deliverables](#required-deliverables)
  - [11. SiYuan API Quick Reference](#11-siyuan-api-quick-reference)
    - [API Specification](#api-specification)
    - [Response Format](#response-format)
    - [11.1 Block Operations](#111-block-operations)
    - [11.2 Attribute Operations](#112-attribute-operations)
    - [11.3 Notification \& System](#113-notification--system)
    - [11.4 SQL Query Examples](#114-sql-query-examples)
  - [12. Implementation Guidelines](#12-implementation-guidelines)
    - [12.1 Code Organization](#121-code-organization)
    - [12.2 Testing Requirements](#122-testing-requirements)
    - [12.3 Migration Strategy](#123-migration-strategy)
    - [12.4 Error Handling Pattern](#124-error-handling-pattern)
  - [Quick Reference Card](#quick-reference-card)
    - [Layer Responsibilities](#layer-responsibilities)
    - [Event Flow](#event-flow)
    - [Import Rules](#import-rules)

---

## 1. Agent Role Definition

### 1.1 Your Identity

You are acting as a **Senior Full-Stack Plugin Runtime Architect** specialized in SiYuan Plugin Engine development. Your expertise encompasses TypeScript/JavaScript, event-driven architecture, domain-driven design, and the SiYuan kernel API ecosystem.

### 1.2 Your Mission

Refactor the entire `task-recurring-notification-management` codebase to achieve the following architectural qualities:

| Quality | Description |
|---------|-------------|
| **Runtime-Safe** | All operations validated before execution, no undefined behavior |
| **Lifecycle-Aware** | Proper initialization, update, and cleanup sequences |
| **SiYuan-Native** | Direct integration with SiYuan kernel APIs and patterns |
| **Event-Driven** | All state changes emit events for reactive updates |
| **DTO-Isolated** | Data Transfer Objects separate internal and external representations |
| **Domain-Immutable** | Domain entities never mutated directly; transitions via lifecycle methods |
| **Infrastructure-Adapted** | Clean API adapters for SiYuan kernel |
| **Frontend-Reactive** | UI responds to events, never computes domain logic |
| **Import/Export Clean** | No circular dependencies, well-defined public APIs |
| **Dead Code Removed** | Eliminate unused code, deprecated patterns, and legacy imports |

---

## 2. Target System Architecture

### 2.1 Directory Structure

The plugin MUST follow this layered architecture. Each directory has a specific responsibility and must not cross boundaries:

```
src/
├── domain/              # Immutable entities, value objects, domain events, factories
├── application/         # Application services, use cases, orchestration logic
├── infrastructure/      # SiYuan API adapters, external service clients, persistence
├── runtime/             # Scheduler, execution engine, lifecycle manager, boot sequence
├── services/            # TaskService, ReminderService, IntegrationService (ONLY domain mutators)
├── query/               # QueryEngine, DTO mappers, read-only data access
├── cache/               # In-memory cache, invalidation handlers, rebuild logic
├── engine/              # RecurrenceResolver, DependencyExecutionGuard, validators
├── reminders/           # Reminder handlers, notification dispatchers, retry logic
├── dependencies/        # DependencyGraph, circular detection, inheritance resolver
├── escalation/          # Escalation policies, urgency calculators, AI suggestion engine
├── integrations/        # Webhook handlers, external service adapters, retry policies
├── events/              # EventBus, event definitions, subscribers, publishers
├── parsers/             # Markdown parsers, attribute extractors, date resolvers
├── models/              # DTOs, view models, configuration interfaces
├── stores/              # Frontend stores (reactive state management)
├── mounts/              # Mount services, UI registration, lifecycle hooks
├── components/          # UI components, dialogs, panels (consume DTOs only)
├── styles/              # CSS, theme variables, visual styling
└── utils/               # Pure utility functions, helpers, constants
```

| Directory | Responsibility |
|-----------|---------------|
| `domain/` | Immutable entities, value objects, domain events, factories |
| `application/` | Application services, use cases, orchestration logic |
| `infrastructure/` | SiYuan API adapters, external service clients, persistence |
| `runtime/` | Scheduler, execution engine, lifecycle manager, boot sequence |
| `services/` | TaskService, ReminderService, IntegrationService (ONLY domain mutators) |
| `query/` | QueryEngine, DTO mappers, read-only data access |
| `cache/` | In-memory cache, invalidation handlers, rebuild logic |
| `engine/` | RecurrenceResolver, DependencyExecutionGuard, validators |
| `reminders/` | Reminder handlers, notification dispatchers, retry logic |
| `dependencies/` | DependencyGraph, circular detection, inheritance resolver |
| `escalation/` | Escalation policies, urgency calculators, AI suggestion engine |
| `integrations/` | Webhook handlers, external service adapters, retry policies |
| `events/` | EventBus, event definitions, subscribers, publishers |
| `parsers/` | Markdown parsers, attribute extractors, date resolvers |
| `models/` | DTOs, view models, configuration interfaces |
| `stores/` | Frontend stores (reactive state management) |
| `mounts/` | Mount services, UI registration, lifecycle hooks |
| `components/` | UI components, dialogs, panels (consume DTOs only) |
| `styles/` | CSS, theme variables, visual styling |
| `utils/` | Pure utility functions, helpers, constants |

---

## 3. Core Architecture Rules

### 3.1 Domain Layer - Immutable Runtime Truth

The Domain layer is the heart of the system. All domain entities must be immutable and can only be modified through factory methods and lifecycle transitions. This ensures predictable state changes and enables event sourcing patterns.

#### Task Entity Requirements

✅ **Required:**
- Must be created via `TaskFactory.create()` only
- Must be updated via `TaskLifecycle.transition()` only
- Must never be mutated inline or directly
- All state changes must emit domain events

❌ **FORBIDDEN PATTERNS:**

```typescript
// ❌ NEVER DO THIS:
task.completed = true
task.due = newDate
task.dependsOn.push(newDep)
Object.assign(task, updates)
```

#### Domain Layer Structure

```typescript
// domain/Task.ts
export interface Task {
  readonly id: string
  readonly blockId: string
  readonly title: string
  readonly due: Date | null
  readonly completed: boolean
  readonly recurrence: RecurrencePattern | null
  readonly dependsOn: readonly string[]
  readonly urgency: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

// domain/TaskFactory.ts
export class TaskFactory {
  static create(params: TaskCreateParams): Task
  static fromBlockAttributes(blockId: string, attrs: BlockAttributes): Task | null
}

// domain/TaskLifecycle.ts
export class TaskLifecycle {
  static transition(task: Task, event: TaskEvent): Task
  static complete(task: Task): Task
  static reschedule(task: Task, newDue: Date): Task
  static addDependency(task: Task, depId: string): Task
}
```

---

### 3.2 Application/Services Layer - Single Mutation Authority

TaskService is the ONLY module permitted to perform domain mutations. This centralization ensures all changes go through proper validation, event emission, and side-effect handling.

#### Authorized TaskService Methods

| Method | Purpose |
|--------|---------|
| `createTask()` | Instantiate new task via TaskFactory |
| `updateTask()` | Apply validated updates via lifecycle |
| `completeTask()` | Mark task complete, emit completion event |
| `rescheduleTask()` | Update due date with recurrence handling |
| `deleteTask()` | Remove task, cleanup dependencies |
| `generateRecurrence()` | Create next instance from pattern |
| `linkDependency()` | Add task dependency with validation |
| `applyAISuggestion()` | Apply AI-recommended changes |

#### TaskService Implementation Pattern

```typescript
// services/TaskService.ts
export class TaskService {
  constructor(
    private readonly taskStorage: TaskStorage,
    private readonly cache: TaskCache,
    private readonly eventBus: EventBus,
    private readonly siyuanApi: SiYuanApiAdapter
  ) {}

  async createTask(params: TaskCreateParams): Promise<Task> {
    // 1. Validate params
    const validated = this.validateCreateParams(params)
    
    // 2. Create via factory
    const task = TaskFactory.create(validated)
    
    // 3. Persist via infrastructure
    await this.taskStorage.save(task)
    
    // 4. Update cache
    this.cache.add(task)
    
    // 5. Emit event
    this.eventBus.emit('task:runtime:created', { task })
    
    return task
  }

  async completeTask(taskId: string): Promise<Task> {
    // 1. Get from cache
    const task = this.cache.getById(taskId)
    if (!task) throw new TaskNotFoundError(taskId)
    
    // 2. Transition via lifecycle
    const completedTask = TaskLifecycle.complete(task)
    
    // 3. Persist
    await this.taskStorage.save(completedTask)
    
    // 4. Invalidate cache
    this.cache.invalidate(taskId)
    
    // 5. Emit event
    this.eventBus.emit('task:runtime:completed', { task: completedTask })
    
    // 6. Handle recurrence
    if (completedTask.recurrence) {
      await this.generateRecurrence(completedTask)
    }
    
    return completedTask
  }
}
```

---

### 3.3 Infrastructure Layer - SiYuan API Adapter

The Infrastructure layer handles all external communication with the SiYuan kernel. It normalizes raw API responses into DTOs and emits runtime events for internal consumption. NO business logic belongs here.

#### Required SiYuan API Endpoints

| Endpoint | Usage |
|----------|-------|
| `POST /api/block/*` | Block CRUD operations |
| `POST /api/attr/getBlockAttrs` | Read block custom attributes |
| `POST /api/attr/setBlockAttrs` | Write block custom attributes |
| `POST /api/system/bootProgress` | Check system boot status |
| `POST /api/notification/pushMsg` | Push notification to user |
| `POST /api/query/sql` | Execute SQL queries on blocks |

#### Infrastructure Adapter Pattern

```typescript
// infrastructure/SiYuanApiAdapter.ts
export class SiYuanApiAdapter {
  private readonly endpoint = 'http://127.0.0.1:6806'
  private readonly token: string

  async getBlockAttributes(blockId: string): Promise<BlockAttributes> {
    const response = await fetch(`${this.endpoint}/api/attr/getBlockAttrs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.token}`
      },
      body: JSON.stringify({ id: blockId })
    })
    
    const { code, data } = await response.json()
    if (code !== 0) throw new SiYuanApiError(code)
    
    return this.normalizeAttributes(data)
  }

  async setBlockAttributes(blockId: string, attrs: BlockAttributes): Promise<void> {
    const response = await fetch(`${this.endpoint}/api/attr/setBlockAttrs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${this.token}`
      },
      body: JSON.stringify({ id: blockId, attrs })
    })
    
    const { code } = await response.json()
    if (code !== 0) throw new SiYuanApiError(code)
  }

  private normalizeAttributes(raw: any): BlockAttributes {
    // Extract custom-* attributes and normalize
    return {
      id: raw.id,
      type: raw.type,
      customDue: raw['custom-due'],
      customRecurrence: raw['custom-recurrence'],
      customDependsOn: raw['custom-depends-on'],
      // ... other attributes
    }
  }
}
```

❌ **INFRASTRUCTURE FORBIDDEN:**
- Domain logic implementation
- Scheduler logic implementation
- UI rendering or component logic

---

### 3.4 Runtime Layer - Execution Pipeline

All task execution must follow this strict pipeline. Each stage validates and transforms data before passing to the next. Any failure aborts the pipeline gracefully.

#### Execution Pipeline Sequence

```
1. Scheduler.tick()                    → Initiate execution cycle
2. QueryService.selectDue()            → Fetch due tasks from cache
3. DependencyExecutionGuard            → Check blocking dependencies
4. RecurrenceResolver                  → Resolve latest recurrence instance
5. BlockAttributeValidator             → Validate block existence
6. TaskLifecycle.transition()          → Apply state change
7. EventBus.emit()                     → Broadcast domain event
8. ReminderService.fire()              → Dispatch notifications
9. IntegrationService.fire()           → Trigger webhooks
10. SmartSuggestionEngine.analyze()    → Generate AI suggestions
```

#### Pipeline Implementation Pattern

```typescript
// runtime/ExecutionPipeline.ts
export class ExecutionPipeline {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly queryService: QueryService,
    private readonly dependencyGuard: DependencyExecutionGuard,
    private readonly recurrenceResolver: RecurrenceResolver,
    private readonly blockValidator: BlockAttributeValidator,
    private readonly eventBus: EventBus,
    private readonly reminderService: ReminderService,
    private readonly integrationService: IntegrationService,
    private readonly aiEngine: SmartSuggestionEngine
  ) {}

  async execute(): Promise<ExecutionResult> {
    // 1. Get due tasks
    const dueTasks = await this.queryService.selectDue()
    
    for (const task of dueTasks) {
      try {
        // 2. Check dependencies
        if (await this.dependencyGuard.isBlocked(task)) {
          continue // Skip blocked tasks
        }
        
        // 3. Resolve recurrence
        const resolvedTask = await this.recurrenceResolver.resolve(task)
        
        // 4. Validate block exists
        if (!await this.blockValidator.validate(resolvedTask.blockId)) {
          continue // Skip invalid blocks
        }
        
        // 5. Emit due event
        this.eventBus.emit('task:reminder:due', { task: resolvedTask })
        
        // 6. Fire reminders
        await this.reminderService.fire(resolvedTask)
        
        // 7. Fire integrations
        await this.integrationService.fire(resolvedTask)
        
        // 8. AI analysis (only for specific events)
        await this.aiEngine.analyze(resolvedTask)
        
      } catch (error) {
        this.handleError(error, task)
      }
    }
    
    return { processed: dueTasks.length }
  }
}
```

---

## 4. Specialized Layer Rules

### 4.1 Query Layer - Read-Only Data Access

QueryEngine provides a clean read interface to the Cache layer. It applies filters, sorting, and pagination without ever touching the underlying storage directly. This separation enables caching optimization and ensures consistent data views.

#### Query Rules

✅ **Required:**
- Read ONLY from Cache, never from TaskStorage
- Validate block existence before returning results
- Exclude completed tasks from due queries
- Exclude blocked tasks from execution queries
- Resolve latest recurrence instance automatically

❌ **FORBIDDEN:**
- Direct TaskStorage read access

```typescript
// query/QueryEngine.ts
export class QueryEngine {
  constructor(private readonly cache: TaskCache) {}

  selectDue(): Task[] {
    return this.cache.getAll()
      .filter(task => !task.completed)
      .filter(task => this.isOverdue(task))
      .filter(task => !this.isBlocked(task))
      .map(task => this.resolveLatestRecurrence(task))
  }

  selectById(id: string): Task | null {
    return this.cache.getById(id)
  }

  selectByBlockId(blockId: string): Task | null {
    return this.cache.getByBlockId(blockId)
  }
}
```

---

### 4.2 Cache Layer - In-Memory State

The Cache maintains an optimized in-memory representation of tasks for fast queries. It must rebuild on storage load and invalidate reactively based on domain events.

#### Cache Invalidation Triggers

| Event | Action |
|-------|--------|
| `task:completed` | Remove from active cache |
| `task:deleted` | Remove from all caches |
| `task:recurrence:generated` | Add new instance |
| `plugin:storage:reload` | Full rebuild |
| `block:updated` | Refresh specific task |

```typescript
// cache/TaskCache.ts
export class TaskCache {
  private tasks: Map<string, Task> = new Map()
  private byBlockId: Map<string, string> = new Map()
  private readonly eventBus: EventBus

  constructor(eventBus: EventBus) {
    this.subscribeToEvents()
  }

  private subscribeToEvents(): void {
    this.eventBus.on('task:completed', ({ task }) => {
      this.tasks.delete(task.id)
    })

    this.eventBus.on('task:deleted', ({ taskId }) => {
      this.tasks.delete(taskId)
    })

    this.eventBus.on('task:recurrence:generated', ({ task }) => {
      this.add(task)
    })

    this.eventBus.on('plugin:storage:reload', () => {
      this.rebuild()
    })

    this.eventBus.on('block:updated', ({ blockId }) => {
      this.refreshByBlockId(blockId)
    })
  }

  rebuild(): void {
    this.tasks.clear()
    this.byBlockId.clear()
    // Load from storage...
  }
}
```

---

### 4.3 Dependency Layer - Execution Guard

The DependencyGraph manages task relationships and prevents execution of blocked tasks. It detects circular dependencies, handles recurrence inheritance, and suppresses execution appropriately.

#### Dependency Rules

✅ **Required:**
- Prevent circular dependency chains
- Inherit recurrence patterns safely from parent tasks
- Suppress execution if any dependency is incomplete
- Scheduler must NOT emit due events for blocked tasks

```typescript
// dependencies/DependencyGraph.ts
export class DependencyGraph {
  private graph: Map<string, Set<string>> = new Map()

  addDependency(taskId: string, dependsOnId: string): void {
    // Check for circular dependency
    if (this.wouldCreateCycle(taskId, dependsOnId)) {
      throw new CircularDependencyError(taskId, dependsOnId)
    }
    
    if (!this.graph.has(taskId)) {
      this.graph.set(taskId, new Set())
    }
    this.graph.get(taskId)!.add(dependsOnId)
  }

  isBlocked(taskId: string, completedIds: Set<string>): boolean {
    const dependencies = this.graph.get(taskId)
    if (!dependencies) return false
    
    for (const depId of dependencies) {
      if (!completedIds.has(depId)) {
        return true
      }
    }
    return false
  }

  private wouldCreateCycle(taskId: string, dependsOnId: string): boolean {
    // DFS to check if adding this edge would create a cycle
    const visited = new Set<string>()
    const stack = [dependsOnId]
    
    while (stack.length > 0) {
      const current = stack.pop()!
      if (current === taskId) return true
      if (visited.has(current)) continue
      visited.add(current)
      
      const deps = this.graph.get(current)
      if (deps) {
        stack.push(...deps)
      }
    }
    return false
  }
}
```

---

### 4.4 Reminder Layer - Notification Dispatch

ReminderService handles all user notifications. It ensures each overdue state triggers exactly one reminder, suppresses reminders for blocked tasks, and resolves the latest recurrence instance before dispatch.

#### Reminder Rules

✅ **Required:**
- Fire once per overdue state transition
- Suppress if task is blocked by dependencies
- Resolve latest recurrence before firing

#### Retry Validation Requirements

✅ **Must validate before retry:**
- Block exists in SiYuan
- Task not completed
- Task not archived

```typescript
// reminders/ReminderService.ts
export class ReminderService {
  private firedReminders: Set<string> = new Set()
  
  constructor(
    private readonly siyuanApi: SiYuanApiAdapter,
    private readonly dependencyGraph: DependencyGraph,
    private readonly recurrenceResolver: RecurrenceResolver
  ) {}

  async fire(task: Task): Promise<void> {
    // 1. Check if blocked
    if (await this.isBlocked(task)) {
      return // Suppress reminder
    }
    
    // 2. Resolve latest recurrence
    const latestTask = await this.recurrenceResolver.resolveLatest(task)
    
    // 3. Check if already fired for this state
    const reminderKey = this.getReminderKey(latestTask)
    if (this.firedReminders.has(reminderKey)) {
      return // Already fired
    }
    
    // 4. Validate before firing
    if (!await this.validate(latestTask)) {
      return
    }
    
    // 5. Push notification
    await this.siyuanApi.pushNotification({
      msg: `Task due: ${latestTask.title}`,
      timeout: 7000
    })
    
    // 6. Mark as fired
    this.firedReminders.add(reminderKey)
  }

  private async validate(task: Task): Promise<boolean> {
    // Block exists
    const block = await this.siyuanApi.getBlock(task.blockId)
    if (!block) return false
    
    // Task not completed
    if (task.completed) return false
    
    // Task not archived
    if (block.archived) return false
    
    return true
  }
}
```

---

### 4.5 Integration Layer - Webhook Dispatch

IntegrationService manages external webhooks and integrations. It fires only after runtime validation, attaches to the latest recurrence instance, and implements retry logic with proper validation.

#### Integration Rules

✅ **Required:**
- Fire only after runtime validation passes
- Attach to latest recurrence instance
- Retry only if task remains valid

❌ **FORBIDDEN:**
- Retry must NOT increase AI urgency score

```typescript
// integrations/IntegrationService.ts
export class IntegrationService {
  async fire(task: Task): Promise<void> {
    // 1. Validate task state
    if (!await this.validate(task)) {
      return
    }
    
    // 2. Get configured webhooks
    const webhooks = await this.getWebhooks()
    
    // 3. Fire each webhook
    for (const webhook of webhooks) {
      try {
        await this.fireWebhook(webhook, task)
      } catch (error) {
        await this.handleRetry(webhook, task, error)
      }
    }
  }

  private async handleRetry(webhook: Webhook, task: Task, error: Error): Promise<void> {
    // Validate task still valid before retry
    if (!await this.validate(task)) {
      return // Don't retry invalid tasks
    }
    
    // Retry with exponential backoff
    // IMPORTANT: Do NOT modify task.urgency here!
    await this.retryWithBackoff(webhook, task)
  }
}
```

---

### 4.6 AI/ML Layer - Smart Suggestions

SmartSuggestionEngine analyzes task patterns and generates actionable suggestions. It only triggers after specific lifecycle events to avoid noise from routine operations.

#### AI Trigger Events

✅ **TRIGGER AFTER:**

| Event | Purpose |
|-------|---------|
| `task:runtime:completed` | Analyze completion patterns |
| `task:runtime:missed` | Analyze missed deadline patterns |

❌ **DO NOT TRIGGER AFTER:**

| Event | Reason |
|-------|--------|
| `reschedule` events | Avoid noise from date adjustments |
| `postpone` events | Avoid noise from postponements |

```typescript
// escalation/SmartSuggestionEngine.ts
export class SmartSuggestionEngine {
  constructor(private readonly eventBus: EventBus) {
    // Only subscribe to specific events
    this.eventBus.on('task:runtime:completed', this.analyzeCompletion.bind(this))
    this.eventBus.on('task:runtime:missed', this.analyzeMissedDeadline.bind(this))
    
    // DO NOT subscribe to reschedule or postpone events
  }

  async analyzeCompletion({ task }: { task: Task }): Promise<AISuggestion[]> {
    // Analyze patterns in completion history
    // Generate suggestions for similar tasks
    return this.generateSuggestions(task, 'completion')
  }

  async analyzeMissedDeadline({ task }: { task: Task }): Promise<AISuggestion[]> {
    // Analyze why deadline was missed
    // Suggest improvements
    return this.generateSuggestions(task, 'missed')
  }
}
```

---

## 5. Frontend Architecture Rules

Frontend code (components, stores, services, styles) must remain decoupled from domain logic. It consumes DTOs, subscribes to events, and delegates all mutations to TaskService. This separation ensures UI reactivity without coupling to internal implementation.

### Frontend Requirements

✅ **Required:**
- Consume DTO models only, never domain entities
- Subscribe to state changes via EventService
- Delegate all mutations to TaskService API
- Use reactive stores for UI state management

### Frontend Forbidden Actions

❌ **FORBIDDEN:**
- Import domain layer modules
- Compute lifecycle states locally
- Derive dependency graphs locally
- Normalize due dates locally
- Call SiYuan API directly

```typescript
// stores/TaskStore.ts (Frontend)
export class TaskStore {
  private tasks: TaskDTO[] = []
  
  constructor(
    private readonly eventService: EventService,
    private readonly taskService: TaskServiceAPI // Frontend API client
  ) {
    // Subscribe to events for reactivity
    this.eventService.on('task:runtime:created', this.onTaskCreated.bind(this))
    this.eventService.on('task:runtime:completed', this.onTaskCompleted.bind(this))
    this.eventService.on('task:runtime:rescheduled', this.onTaskRescheduled.bind(this))
  }

  // Mutations go through TaskService only
  async completeTask(taskId: string): Promise<void> {
    await this.taskService.completeTask(taskId)
    // Store will update via event subscription
  }

  async createTask(params: TaskCreateParams): Promise<void> {
    await this.taskService.createTask(params)
    // Store will update via event subscription
  }

  // Local state updates from events
  private onTaskCreated({ task }: { task: TaskDTO }): void {
    this.tasks.push(task)
  }

  private onTaskCompleted({ task }: { task: TaskDTO }): void {
    const index = this.tasks.findIndex(t => t.id === task.id)
    if (index >= 0) {
      this.tasks[index] = task
    }
  }
}
```

---

## 6. Mount Layer - Boot Sequence

All mount operations must wait for the complete boot sequence. This ensures all services are initialized, caches are populated, and the system is ready before any user interaction.

### Required Boot Sequence

```
1. BootProgress == 100       → SiYuan kernel fully loaded
2. TaskStorage.load()        → Plugin storage initialized
3. Cache.rebuild()           → In-memory cache populated
4. Scheduler.sync()          → Task scheduler synchronized
5. Analytics.load()          → Historical data loaded
6. RuntimeReady.emit()       → System ready signal
```

```typescript
// mounts/MountService.ts
export class MountService {
  constructor(
    private readonly siyuanApi: SiYuanApiAdapter,
    private readonly taskStorage: TaskStorage,
    private readonly cache: TaskCache,
    private readonly scheduler: Scheduler,
    private readonly analytics: AnalyticsService,
    private readonly eventBus: EventBus
  ) {}

  async mount(): Promise<void> {
    // 1. Wait for SiYuan boot
    await this.waitForBootProgress()
    
    // 2. Load plugin storage
    await this.taskStorage.load()
    
    // 3. Rebuild cache
    await this.cache.rebuild()
    
    // 4. Sync scheduler
    await this.scheduler.sync()
    
    // 5. Load analytics
    await this.analytics.load()
    
    // 6. Emit ready signal
    this.eventBus.emit('runtime:ready', {})
    
    // 7. Mount UI components
    this.mountUIComponents()
  }

  private async waitForBootProgress(): Promise<void> {
    while (true) {
      const { progress } = await this.siyuanApi.getBootProgress()
      if (progress === 100) break
      await this.sleep(100)
    }
  }

  unmount(): void {
    // Cleanup in reverse order
    this.unmountUIComponents()
    this.scheduler.stop()
    this.cache.clear()
    this.taskStorage.save()
  }
}
```

---

## 7. Event Flow Specification

All runtime state changes must emit events through the EventBus. This enables reactive updates, logging, and cross-module communication without tight coupling.

### Required Domain Events

| Event Name | Trigger Condition |
|------------|-------------------|
| `task:runtime:created` | New task instantiated |
| `task:runtime:completed` | Task marked complete |
| `task:runtime:rescheduled` | Due date changed |
| `task:runtime:dependencyChanged` | Dependency added/removed |
| `task:runtime:recurrenceGenerated` | New recurrence instance created |
| `task:reminder:due` | Reminder triggered |
| `task:webhook:fired` | Webhook dispatched |

```typescript
// events/EventBus.ts
export type DomainEvent = 
  | 'task:runtime:created'
  | 'task:runtime:completed'
  | 'task:runtime:rescheduled'
  | 'task:runtime:dependencyChanged'
  | 'task:runtime:recurrenceGenerated'
  | 'task:reminder:due'
  | 'task:webhook:fired'
  | 'task:runtime:missed'
  | 'plugin:storage:reload'
  | 'block:updated'
  | 'runtime:ready'

export type EventPayload = {
  'task:runtime:created': { task: Task }
  'task:runtime:completed': { task: Task }
  'task:runtime:rescheduled': { task: Task; previousDue: Date | null }
  'task:runtime:dependencyChanged': { task: Task; dependencyId: string; action: 'add' | 'remove' }
  'task:runtime:recurrenceGenerated': { task: Task; parentTask: Task }
  'task:reminder:due': { task: Task }
  'task:webhook:fired': { task: Task; webhook: Webhook }
  'task:runtime:missed': { task: Task }
  'plugin:storage:reload': {}
  'block:updated': { blockId: string }
  'runtime:ready': {}
}

export class EventBus {
  private listeners: Map<string, Set<Function>> = new Map()

  on<E extends DomainEvent>(event: E, handler: (payload: EventPayload[E]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(handler)
  }

  off<E extends DomainEvent>(event: E, handler: Function): void {
    this.listeners.get(event)?.delete(handler)
  }

  emit<E extends DomainEvent>(event: E, payload: EventPayload[E]): void {
    const handlers = this.listeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        handler(payload)
      }
    }
  }
}
```

---

## 8. Global Forbidden Actions

The following actions are strictly prohibited across ALL modules. Violation of these rules indicates a fundamental architectural error that must be corrected immediately.

### Universal Prohibitions

❌ **NEVER:**

1. **Mutate domain entities directly** — Use TaskService only
2. **Parse markdown outside designated parser modules** — All parsing in `parsers/`
3. **Call SiYuan API outside infrastructure layer** — All API calls through `infrastructure/`
4. **Trigger scheduler from UI components** — Scheduler controlled by runtime only
5. **Fire integrations from modal dialogs** — Integrations triggered by events only
6. **Import domain modules in frontend code** — Frontend uses DTOs from `models/`
7. **Compute overdue status locally in components** — Use QueryEngine
8. **Resolve recurrence locally in components** — Use RecurrenceResolver
9. **Bypass TaskService for mutations** — All mutations through TaskService
10. **Skip event emission** — All state changes must emit events

---

## 9. Post-Refactor Validation Checklist

After completing the refactoring, verify all items in this checklist pass. Any failure indicates incomplete or incorrect implementation.

| Feature | Required | Status |
|---------|----------|--------|
| Recurring instance generation correct | ✓ | [ ] Verified |
| Blocked tasks suppressed from execution | ✓ | [ ] Verified |
| Reminder fires exactly once per overdue state | ✓ | [ ] Verified |
| Scheduler produces deterministic results | ✓ | [ ] Verified |
| AI urgency calculations correct | ✓ | [ ] Verified |
| Dashboard updates reactively | ✓ | [ ] Verified |
| Integration fires exactly once per event | ✓ | [ ] Verified |
| Plugin reload is safe (no data loss) | ✓ | [ ] Verified |
| No stale cache after updates | ✓ | [ ] Verified |
| No circular import dependencies | ✓ | [ ] Verified |

### Validation Test Cases

```typescript
// tests/validation/refactor-validation.test.ts

describe('Post-Refactor Validation', () => {
  test('Recurring instance generation correct', async () => {
    // Create recurring task
    // Complete current instance
    // Verify next instance created with correct due date
  })

  test('Blocked tasks suppressed from execution', async () => {
    // Create task with dependency
    // Verify blocked task not returned by QueryService.selectDue()
    // Complete dependency
    // Verify task now returned
  })

  test('Reminder fires exactly once per overdue state', async () => {
    // Create overdue task
    // Run scheduler tick
    // Verify exactly one reminder fired
    // Run scheduler tick again
    // Verify no duplicate reminder
  })

  test('Scheduler produces deterministic results', async () => {
    // Run scheduler with same initial state twice
    // Verify identical results
  })

  test('No circular import dependencies', async () => {
    // Use madge or similar tool to detect cycles
    const cycles = await detectCircularDependencies('src/')
    expect(cycles).toHaveLength(0)
  })
})
```

---

## 10. Expected Output Artifacts

Upon completing the refactoring, the following deliverables must be produced. Each artifact should be fully documented with TypeScript types and follow the architectural boundaries defined in this prompt.

### Required Deliverables

1. **Immutable Domain Layer** — Task, TaskFactory, TaskLifecycle, domain events
2. **Lifecycle-safe Runtime Engine** — Scheduler, execution pipeline, boot sequence
3. **Infrastructure API Adapter** — SiYuan API client, response normalizers, DTO mappers
4. **Dependency-safe Execution Guard** — DependencyGraph, circular detection, blocking resolver
5. **Recurrence-safe Resolver** — Pattern parser, instance generator, inheritance handler
6. **DTO-based Frontend** — View models, reactive stores, event subscriptions
7. **Event-driven Store System** — EventBus, event definitions, subscribers
8. **Lifecycle-aware MountService** — Boot sequence, UI registration, cleanup handlers
9. **Import/export-safe modules** — No circular dependencies, clean public APIs
10. **Dead code removed** — Unused imports, deprecated functions, legacy patterns

---

## 11. SiYuan API Quick Reference

This section provides essential API endpoints for the refactoring. All API calls must go through the infrastructure layer with proper error handling and response normalization.

### API Specification

- **Endpoint:** `http://127.0.0.1:6806`
- **Method:** All requests use `POST`
- **Content-Type:** `application/json`
- **Authentication:** `Authorization: Token xxx` (get token from Settings → About)

### Response Format

```json
{
  "code": 0,
  "msg": "",
  "data": {}
}
```

- `code`: Non-zero for exceptions
- `msg`: Error text under abnormal conditions
- `data`: Response data (varies by endpoint)

### 11.1 Block Operations

| Endpoint | Parameters | Description |
|----------|------------|-------------|
| `POST /api/block/insertBlock` | `dataType, data, nextID, previousID, parentID` | Insert new block |
| `POST /api/block/updateBlock` | `dataType, data, id` | Update existing block |
| `POST /api/block/deleteBlock` | `id` | Delete block |
| `POST /api/block/getChildBlocks` | `id` | Get child blocks |
| `POST /api/block/moveBlock` | `id, previousID, parentID` | Move block |

### 11.2 Attribute Operations

| Endpoint | Parameters | Description |
|----------|------------|-------------|
| `POST /api/attr/setBlockAttrs` | `{ id, attrs: { "custom-*": value } }` | Set custom attributes |
| `POST /api/attr/getBlockAttrs` | `{ id }` | Get block attributes |

**GetBlockAttrs Response:**
```json
{
  "code": 0,
  "msg": "",
  "data": {
    "custom-due": "2024-01-15",
    "custom-recurrence": "FREQ=DAILY",
    "custom-depends-on": "task-id-1,task-id-2",
    "id": "block-id",
    "type": "NodeParagraph",
    "updated": "20240115000000"
  }
}
```

### 11.3 Notification & System

| Endpoint | Parameters | Description |
|----------|------------|-------------|
| `POST /api/notification/pushMsg` | `{ msg, timeout? }` | Push message notification |
| `POST /api/notification/pushErrMsg` | `{ msg, timeout? }` | Push error notification |
| `POST /api/system/bootProgress` | (none) | Check boot progress |
| `POST /api/query/sql` | `{ stmt }` | Execute SQL query |

**BootProgress Response:**
```json
{
  "code": 0,
  "msg": "",
  "data": {
    "details": "Finishing boot...",
    "progress": 100
  }
}
```

### 11.4 SQL Query Examples

```sql
-- Find all blocks with custom-due attribute
SELECT * FROM blocks 
WHERE content LIKE '%custom-due%' 
AND type = 'p'

-- Find tasks due today
SELECT * FROM blocks 
WHERE content LIKE '%{{today}}%'
```

---

## 12. Implementation Guidelines

### 12.1 Code Organization

When implementing the refactored codebase, follow these organizational principles to maintain architectural integrity:

- Each module should have a single, well-defined responsibility
- Use barrel exports (`index.ts`) for clean public APIs
- Document all public interfaces with JSDoc comments
- Use strict TypeScript configuration (no `any` types)
- Implement proper error boundaries at each layer

### 12.2 Testing Requirements

All refactored components must include comprehensive tests covering:

- **Unit tests** for domain logic (factories, lifecycle transitions)
- **Integration tests** for service layer interactions
- **End-to-end tests** for complete execution pipeline
- **Edge case tests** for recurrence and dependency scenarios

### 12.3 Migration Strategy

When migrating from the existing codebase, follow this phased approach to minimize disruption:

| Phase | Focus Area |
|-------|------------|
| **Phase 1** | Implement infrastructure layer with SiYuan API adapters |
| **Phase 2** | Create domain entities and factory methods |
| **Phase 3** | Implement cache and query layers |
| **Phase 4** | Build runtime engine and scheduler |
| **Phase 5** | Migrate frontend to DTO-based architecture |
| **Phase 6** | Remove deprecated code and optimize |

### 12.4 Error Handling Pattern

```typescript
// utils/errors.ts
export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`)
    this.name = 'TaskNotFoundError'
  }
}

export class CircularDependencyError extends Error {
  constructor(taskId: string, dependsOnId: string) {
    super(`Circular dependency detected: ${taskId} → ${dependsOnId}`)
    this.name = 'CircularDependencyError'
  }
}

export class SiYuanApiError extends Error {
  constructor(public readonly code: number) {
    super(`SiYuan API error: ${code}`)
    this.name = 'SiYuanApiError'
  }
}

export class BlockValidationError extends Error {
  constructor(blockId: string, reason: string) {
    super(`Block validation failed for ${blockId}: ${reason}`)
    this.name = 'BlockValidationError'
  }
}
```

---

## Quick Reference Card

### Layer Responsibilities

| Layer | Can Do | Cannot Do |
|-------|--------|-----------|
| **Domain** | Define entities, emit events | Call APIs, mutate state |
| **Services** | Mutate domain via lifecycle | Call SiYuan API directly |
| **Infrastructure** | Call SiYuan API, normalize responses | Business logic |
| **Runtime** | Orchestrate execution | Mutate domain directly |
| **Query** | Read from cache | Write to storage |
| **Cache** | Store in-memory state | Persist data |
| **Frontend** | Consume DTOs, emit UI events | Import domain, call APIs |

### Event Flow

```
User Action → Frontend → TaskService → TaskLifecycle → EventBus → Cache/Stores/UI
                                    ↓
                              Infrastructure → SiYuan API
```

### Import Rules

```
domain/        ← (nothing)
services/      ← domain/, events/
infrastructure/← (nothing)
runtime/       ← services/, query/, cache/, events/
query/         ← cache/, models/
cache/         ← events/, models/
frontend/      ← models/ (DTOs only), services/ (API client only)
```

---

