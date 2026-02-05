# Naming Conventions & Standards

**Date:** February 5, 2026  
**Purpose:** Consistent naming rules for the refactored codebase

---

## 📁 FOLDER NAMING

### Rule: Always `kebab-case` for folders

```
✅ CORRECT                    ❌ WRONG
backend/                     Backend/
  core/                        Core/
  block-actions/              blockActions/
  inline-query/               inlineQuery/
  
frontend/                    Frontend/
  common/                      Common/
  keyboard-shortcuts/          keyboardShortcuts/
```

**Rationale:** 
- URL-safe
- Works on all operating systems (case-insensitive)
- Easy to type (no shift key)
- Industry standard

---

## 📄 FILE NAMING

### Classes & Components: `PascalCase.ts`

```typescript
✅ CORRECT                    ❌ WRONG
TaskManager.ts               taskManager.ts
RecurrenceEngine.ts          recurrence-engine.ts
DateParser.ts                date_parser.ts
AISuggestionsPanel.svelte    aiSuggestionsPanel.svelte
```

**Applies to:**
- Classes
- Svelte components
- React components
- Main exports that are classes

---

### Services: `PascalCase.ts` or `PascalCaseService.ts`

```typescript
✅ CORRECT (Option 1)         ✅ CORRECT (Option 2)
EventService.ts              Event.service.ts
SettingsService.ts           Settings.service.ts
BulkService.ts               Bulk.service.ts

❌ WRONG
eventService.ts
event-service.ts
```

**Recommended:** Use `PascalCaseService.ts` pattern for clarity

**Rationale:** Makes it obvious the file contains a service class

---

### Utilities: `kebab-case.ts`

```typescript
✅ CORRECT                    ❌ WRONG
debounce.ts                  Debounce.ts
fuzzy-search.ts              fuzzySearch.ts
keyboard-handler.ts          keyboardHandler.ts
date-tools.ts                DateTools.ts
```

**Applies to:**
- Pure utility functions
- Helper modules
- Standalone functions (not classes)

---

### Type Definitions: `kebab-case.types.ts`

```typescript
✅ CORRECT                    ❌ WRONG
task.types.ts                TaskTypes.ts
event.types.ts               EventTypes.ts
recurrence.types.ts          recurrenceTypes.ts
webhook.types.ts             Webhook.types.ts
```

**Pattern:** `[domain].types.ts`

**Rationale:** Clear that file contains only type definitions

---

### Stores (Svelte): `kebab-case.store.ts`

```typescript
✅ CORRECT                    ❌ WRONG
task-order.store.ts          taskOrderStore.ts
search.store.ts              SearchStore.ts
i18n.store.ts                i18nStore.ts
bulk-selection.store.ts      bulkSelectionStore.ts
```

**Pattern:** `[domain].store.ts`

---

### Constants: `kebab-case.ts` or `SCREAMING_SNAKE_CASE.ts`

```typescript
✅ CORRECT                    ❌ WRONG
constants.ts                 Constants.ts
status-configuration.ts      StatusConfiguration.ts
signifiers.ts                Signifiers.ts

✅ ALSO ACCEPTABLE
CONSTANTS.ts                 (if entire file is constants)
STATUS_CODES.ts
```

**Recommended:** Use `kebab-case.ts` unless entire file is uppercase constants

---

### Test Files: `[FileName].test.ts`

```typescript
✅ CORRECT                    ❌ WRONG
TaskManager.test.ts          taskManager.test.ts
DateParser.test.ts           date-parser.test.ts
fuzzy-search.test.ts         fuzzy-search.spec.ts  (use .test, not .spec)

✅ ALSO ACCEPTABLE
task-manager.test.ts         (if testing utility)
```

**Pattern:** Match the file being tested

**Co-location:**
```
src/backend/core/parsers/
  ├── DateParser.ts
  └── DateParser.test.ts       ← Next to source file
```

---

### Configuration: `kebab-case.config.ts`

```typescript
✅ CORRECT                    ❌ WRONG
vite.config.ts               ViteConfig.ts
webpack.config.js            webpackConfig.js
tsconfig.json                tsconfig.JSON
```

**Exception:** Follow tool conventions (e.g., `tsconfig.json`)

---

## 🏷️ EXPORT NAMING

### Classes

```typescript
// PascalCase
export class TaskManager { }
export class RecurrenceEngine { }
export class DateParser { }
```

---

### Interfaces

```typescript
// PascalCase with "I" prefix (optional)
export interface Task { }
export interface ITaskStorage { }    // Optional "I" prefix

// Preferred: No prefix
export interface Task { }
export interface TaskStorage { }
```

---

### Types

```typescript
// PascalCase
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly';
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
```

---

### Functions

```typescript
// camelCase
export function parseTaskLine(line: string): Task { }
export function calculateUrgencyScore(task: Task): number { }

// NOT PascalCase
❌ export function ParseTaskLine(line: string): Task { }
```

---

### Constants

```typescript
// SCREAMING_SNAKE_CASE for primitive constants
export const MAX_RETRY_COUNT = 3;
export const DEFAULT_TIMEOUT = 5000;
export const API_BASE_URL = 'https://api.example.com';

// PascalCase for object constants
export const StatusColors = {
  todo: '#ff0000',
  done: '#00ff00',
  cancelled: '#0000ff',
};

export const EmojisSignifiers = {
  due: '📅',
  recurrence: '🔁',
  priority: '🔺',
};
```

---

### Enums

```typescript
// PascalCase for enum name, PascalCase for members
export enum TaskStatus {
  Todo = 'todo',
  InProgress = 'in-progress',
  Done = 'done',
  Cancelled = 'cancelled',
}

// NOT camelCase
❌ export enum taskStatus { }
```

---

## 📦 IMPORT ALIAS NAMING

### Path Aliases

```typescript
// tsconfig.json
{
  "paths": {
    "@backend/*": ["./src/backend/*"],     ✅
    "@frontend/*": ["./src/frontend/*"],   ✅
    "@shared/*": ["./src/shared/*"],       ✅
    "@/*": ["./src/*"],                    ✅ (general fallback)
  }
}
```

---

### Import Examples

```typescript
// ✅ CORRECT: Absolute imports with aliases
import { TaskManager } from '@backend/core/managers/TaskManager';
import { DateParser } from '@backend/core/parsers/DateParser';
import { Task } from '@backend/core/models/Task';

// ❌ WRONG: Relative imports (avoid)
import { TaskManager } from '../../../backend/core/managers/TaskManager';
import { DateParser } from '../../parsers/DateParser';

// ✅ CORRECT: Barrel exports for related items
import { TaskManager, TaskStorage, TaskRepository } from '@backend/core';

// ❌ WRONG: Mixing styles
import { TaskManager } from '@backend/core/managers/TaskManager';
import { DateParser } from '../../parsers/DateParser';
```

---

## 📋 VARIABLE NAMING

### General Variables

```typescript
// camelCase
const taskCount = 10;
const currentUser = getCurrentUser();
const isEnabled = true;
```

---

### Boolean Variables

```typescript
// Use "is", "has", "should", "can" prefixes
const isEnabled = true;
const hasPermission = false;
const shouldRetry = true;
const canEdit = false;

// NOT
❌ const enabled = true;
❌ const permission = false;
```

---

### Arrays

```typescript
// Plural names
const tasks = [];
const users = [];
const items = [];

// NOT singular
❌ const task = [];
❌ const user = [];
```

---

### Private Class Members

```typescript
class TaskManager {
  // Option 1: underscore prefix
  private _storage: TaskStorage;
  
  // Option 2: # private fields (TypeScript 3.8+)
  #storage: TaskStorage;
  
  // Option 3: No prefix (TypeScript will enforce)
  private storage: TaskStorage;
}

// Recommended: Use TypeScript's private without prefix
```

---

## 🎯 FUNCTION NAMING

### Actions/Commands

```typescript
// Verb + Noun
function createTask() { }
function deleteTask() { }
function updateSettings() { }
function parseDate() { }
function calculateScore() { }
```

---

### Getters

```typescript
// "get" prefix
function getTaskById(id: string): Task { }
function getCurrentUser(): User { }
function getStorageKey(): string { }

// Or use properties
class TaskManager {
  get currentTask(): Task { }
  get isReady(): boolean { }
}
```

---

### Event Handlers

```typescript
// "handle" or "on" prefix
function handleClick(event: MouseEvent) { }
function onTaskComplete(task: Task) { }
function handleSubmit() { }

// In components
const onClick = () => { };
const onTaskUpdate = (task: Task) => { };
```

---

### Validators

```typescript
// "is", "has", "validate" prefix
function isValidTask(task: Task): boolean { }
function hasPermission(user: User): boolean { }
function validateInput(input: string): ValidationResult { }
```

---

## 🗂️ BARREL EXPORT FILES

### index.ts Pattern

```typescript
// ✅ CORRECT: Re-export related modules
// src/backend/core/parsers/index.ts
export { DateParser } from './DateParser';
export { RecurrenceParser } from './RecurrenceParser';
export { TaskLineParser } from './TaskLineParser';
export { InlineTaskParser } from './InlineTaskParser';

// ❌ WRONG: Export unrelated items
export { DateParser } from './DateParser';
export { TaskManager } from '../managers/TaskManager';  // Wrong layer
```

**Rule:** Only export items from same directory or direct children

---

## 🎨 COMPONENT NAMING (Svelte)

### Svelte Components

```svelte
✅ CORRECT                    ❌ WRONG
AISuggestionsPanel.svelte    aiSuggestionsPanel.svelte
TaskEditModal.svelte         task-edit-modal.svelte
DatePicker.svelte            datePicker.svelte
RecurrenceEditor.svelte      recurrence-editor.svelte
```

**Rule:** Always `PascalCase.svelte`

---

### Component Props

```typescript
// Inside component: camelCase
export let taskId: string;
export let isOpen: boolean;
export let onClose: () => void;

// NOT PascalCase or kebab-case
❌ export let TaskId: string;
❌ export let 'is-open': boolean;
```

---

## 📏 CONSISTENT PATTERNS

### Services Pattern

```
✅ RECOMMENDED STRUCTURE

src/backend/services/
  ├── AuthService.ts
  │   └── export class AuthService { }
  ├── EventService.ts
  │   └── export class EventService { }
  ├── SettingsService.ts
  │   └── export class SettingsService { }
  └── types.ts
      └── export interface ServiceConfig { }
```

---

### Repository Pattern

```
✅ RECOMMENDED STRUCTURE

src/backend/core/storage/
  ├── TaskRepository.ts
  │   └── export class TaskRepository { }
  ├── TaskStorage.ts
  │   └── export class TaskStorage { }
  └── TaskIndex.ts
      └── export class TaskIndex { }
```

---

### Manager Pattern

```
✅ RECOMMENDED STRUCTURE

src/backend/core/managers/
  └── TaskManager.ts
      └── export class TaskManager {
           private static instance: TaskManager;
           static getInstance(): TaskManager { }
         }
```

---

## 🚫 ANTI-PATTERNS TO AVOID

### ❌ Mixed Casing in Same Directory

```
❌ BAD
src/backend/services/
  ├── eventService.ts          ← camelCase
  ├── SettingsService.ts       ← PascalCase
  └── Auth-Service.ts          ← kebab-case

✅ GOOD
src/backend/services/
  ├── EventService.ts          ← All PascalCase
  ├── SettingsService.ts
  └── AuthService.ts
```

---

### ❌ Abbreviations Without Consistency

```
❌ BAD
TaskMgr.ts
EvtHandler.ts
RecurEng.ts

✅ GOOD
TaskManager.ts
EventHandler.ts
RecurrenceEngine.ts
```

**Rule:** Avoid abbreviations unless universally understood (e.g., API, URL, ID)

---

### ❌ Redundant Naming

```
❌ BAD
src/backend/services/TaskService.ts
  └── export class TaskServiceService { }  ← Double "Service"

src/backend/managers/TaskManagerManager.ts  ← Double "Manager"

✅ GOOD
src/backend/services/TaskService.ts
  └── export class TaskService { }

src/backend/managers/TaskManager.ts
  └── export class TaskManager { }
```

---

### ❌ Generic "Utils" or "Helpers" Files

```
❌ BAD
utils.ts                     ← Too generic
helpers.ts                   ← What kind of helpers?
misc.ts                      ← Everything goes here!

✅ GOOD
date-utils.ts                ← Specific purpose
string-helpers.ts            ← Clear scope
task-formatters.ts           ← Well-defined
```

---

## 📊 QUICK REFERENCE TABLE

| Item Type | Pattern | Example |
|-----------|---------|---------|
| **Folders** | `kebab-case` | `block-actions/`, `inline-query/` |
| **Classes** | `PascalCase.ts` | `TaskManager.ts`, `DateParser.ts` |
| **Components** | `PascalCase.svelte` | `TaskModal.svelte` |
| **Services** | `PascalCaseService.ts` | `EventService.ts` |
| **Utilities** | `kebab-case.ts` | `debounce.ts`, `fuzzy-search.ts` |
| **Types** | `kebab-case.types.ts` | `task.types.ts` |
| **Stores** | `kebab-case.store.ts` | `task-order.store.ts` |
| **Constants** | `kebab-case.ts` | `constants.ts`, `signifiers.ts` |
| **Tests** | `[FileName].test.ts` | `TaskManager.test.ts` |
| **Variables** | `camelCase` | `taskCount`, `isEnabled` |
| **Functions** | `camelCase` | `parseDate()`, `handleClick()` |
| **Constants (values)** | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| **Enums** | `PascalCase` | `TaskStatus` |
| **Interfaces** | `PascalCase` | `Task`, `TaskStorage` |

---

## ✅ CHECKLIST FOR NAMING

Before creating a new file/folder/export:

- [ ] Is it a folder? → Use `kebab-case`
- [ ] Is it a class/component? → Use `PascalCase.ts`
- [ ] Is it a utility? → Use `kebab-case.ts`
- [ ] Is it a type file? → Use `kebab-case.types.ts`
- [ ] Is it a store? → Use `kebab-case.store.ts`
- [ ] Is it a service? → Use `PascalCaseService.ts`
- [ ] Is it a test? → Match source file + `.test.ts`
- [ ] Does it contain only constants? → Use `SCREAMING_SNAKE_CASE` or `kebab-case.ts`
- [ ] Is the name descriptive? → Avoid `utils`, `misc`, `helpers`
- [ ] Is it consistent with siblings? → Check surrounding files

---

## 🎯 ENFORCEMENT

### Manual Review

- Code reviews should check naming consistency
- PR checklist should include naming verification

### Automated Tools

```bash
# ESLint rules for naming
npm install --save-dev eslint-plugin-naming-convention

# File naming linter
npm install --save-dev ls-lint
```

### Pre-commit Hook

```bash
# .git/hooks/pre-commit
#!/bin/bash
# Check for camelCase files (should be kebab-case)
find src -type f -name '*[A-Z]*.ts' -not -name '*test.ts' | \
  grep -v '\.svelte$' | \
  while read file; do
    echo "Warning: $file uses camelCase, should be kebab-case"
  done
```

---

## 📚 ADDITIONAL RESOURCES

- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Svelte Naming Conventions](https://svelte.dev/docs)

---

**END OF NAMING CONVENTIONS**
