# 🤖 AI AGENT CODING INSTRUCTIONS - SiYuan Task Management Plugin

## 📋 PROJECT OVERVIEW

**Plugin Type:** SiYuan Note-Taking System Plugin  
**Language:** TypeScript + Svelte  
**Purpose:** Advanced recurring task management with AI-driven suggestions  
**Current Status:** Code collected from multiple sources, needs fixing and completion

---

## 🎯 PRIMARY OBJECTIVE

**Fix and complete the TaskEditorModal to be fully functional with all features working end-to-end.**

When a user clicks the task icon, a modal must open with ALL the following features fully wired and operational.

---

## 🧩 CORE REQUIREMENTS

### 1️⃣ TASK EDITOR MODAL STRUCTURE

The modal (`TaskEditorModal`) must contain these sections in order:

```
┌─────────────────────────────────────────────┐
│  📝 TASK EDITOR MODAL                       │
├─────────────────────────────────────────────┤
│                                             │
│  [1] Basic Information                      │
│      • Name (required)                      │
│      • Description (markdown support)       │
│                                             │
│  [2] Priority Selector                      │
│      • Lowest / Low / Medium / High / Highest│
│                                             │
│  [3] Status Selector                        │
│      • Todo / In Progress / Done / Cancelled│
│                                             │
│  [4] Date Inputs                            │
│      • Due Date                             │
│      • Scheduled Date                       │
│      • Start Date                           │
│      • Validation: start ≤ scheduled ≤ due  │
│                                             │
│  [5] Recurrence Input                       │
│      • Daily / Weekly / Monthly / Yearly    │
│      • Custom (cron-like)                   │
│      • Preview: Shows next 5 occurrences    │
│                                             │
│  [6] Dependency Picker                      │
│      • Select tasks this depends on         │
│      • Prevent circular dependencies        │
│                                             │
│  [7] Tags & Category                        │
│      • Tags: Add/remove with # prefix       │
│      • Category: Single text field          │
│                                             │
│  [8] Block Actions Editor                   │
│      • Trigger: When block event happens    │
│      • Action: What to do with task         │
│      • Enable/disable individual actions    │
│                                             │
│  [9] 🤖 AI SUGGESTIONS PANEL                │
│      • 6 AI features (see below)            │
│      • Each has: [Button] → [Result Field]  │
│      • User must approve before applying    │
│                                             │
│  [10] Buttons                               │
│      • [Apply] - Save all changes           │
│      • [Cancel] - Discard changes           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🤖 AI SUGGESTIONS PANEL - DETAILED SPECS

**Location:** Inside TaskEditorModal, after Block Actions Editor  
**Behavior:** ALL features are rule-based (no external ML APIs)

### Feature 1: Abandonment Detection 🗑️

**Button Text:** "Check Abandonment"  
**Trigger Conditions:**
- Task has 5+ misses AND 0 completions, OR
- Completion rate < 10%

**Result Display:**
```
⚠️ Abandonment Detected (85% confidence)
This task has never been completed in 8 occurrences.
Suggestions:
  • Disable task
  • Archive task
  • Reduce frequency
[Apply] [Dismiss]
```

**Implementation:**
```typescript
detectAbandonmentCandidate(task: Task): boolean {
  const missCount = task.missCount || 0;
  const completionCount = task.completionCount || 0;
  
  if (missCount >= 5 && completionCount === 0) return true;
  
  if (missCount + completionCount >= 10) {
    const rate = completionCount / (missCount + completionCount);
    if (rate < 0.1) return true;
  }
  
  return false;
}
```

---

### Feature 2: Reschedule Suggestions ⏰

**Button Text:** "Optimize Schedule"  
**Trigger Conditions:**
- Confidence ≥ 70%
- Time difference ≥ 2 hours from current schedule

**Result Display:**
```
⏰ Better Time Found (78% confidence)
You usually complete this task around 2PM.
Consider moving it from 9AM.
New suggested time: 2:00 PM
[Apply] [Dismiss]
```

**Implementation:**
```typescript
predictBestTime(task: Task): { hour: number; confidence: number } {
  const contexts = task.completionContexts || [];
  if (contexts.length < 3) return { hour: 9, confidence: 0 };
  
  // Count completions by hour
  const hourCounts = new Map<number, number>();
  for (const ctx of contexts) {
    if (!ctx.wasOverdue) {
      hourCounts.set(ctx.hourOfDay, (hourCounts.get(ctx.hourOfDay) || 0) + 1);
    }
  }
  
  // Find most common hour
  let bestHour = 9;
  let maxCount = 0;
  for (const [hour, count] of hourCounts) {
    if (count > maxCount) {
      maxCount = count;
      bestHour = hour;
    }
  }
  
  const confidence = Math.min(maxCount / contexts.length, 1);
  return { hour: bestHour, confidence };
}
```

---

### Feature 3: Urgency Alerts ⚠️

**Button Text:** "Check Urgency"  
**Trigger Conditions:**
- 3+ consecutive misses

**Result Display:**
```
⚠️ High Urgency (90% confidence)
This recurring task has missed 5 occurrences.
Suggestions:
  • Mark as high priority
  • Add reminder
  • Shorten recurrence interval
[Apply] [Dismiss]
```

**Implementation:**
```typescript
detectUrgency(task: Task): boolean {
  return (task.missCount || 0) >= 3 && task.priority !== 'high';
}
```

---

### Feature 4: Frequency Optimization 📊

**Button Text:** "Tune Frequency"  
**Trigger Conditions:**
- Completion rate > 1.5× scheduled rate

**Result Display:**
```
📊 Frequency Mismatch (75% confidence)
You complete this daily task 2.3x more often than scheduled.
Suggestion: Increase frequency to match your pace
[Apply] [Dismiss]
```

**Implementation:**
```typescript
calculateCompletionRate(task: Task): number {
  const completions = task.completionCount || 0;
  const misses = task.missCount || 0;
  const total = completions + misses;
  
  if (total === 0) return 1;
  
  if (task.frequency.type === 'daily') {
    const recentCompletions = task.recentCompletions || [];
    if (recentCompletions.length < 2) return 1;
    
    const dates = recentCompletions.map(c => new Date(c).getTime()).sort();
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24));
    }
    
    const avgDaysBetween = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    return 1 / avgDaysBetween;
  }
  
  return completions / total;
}
```

---

### Feature 5: Task Consolidation 📦

**Button Text:** "Find Similar Tasks" (requires "Analyze All")  
**Trigger Conditions:**
- 3+ similar tasks on same day
- Similar name OR same tags OR same category

**Result Display:**
```
📦 Consolidation Opportunity (65% confidence)
You have 4 similar tasks on the same day:
  • "Morning workout"
  • "Evening workout"
  • "Gym session"
Suggestion: Combine into single batch task
[Apply] [Dismiss]
```

**Implementation:**
```typescript
findSimilarTasks(task: Task, allTasks: Task[]): Task[] {
  const similar: Task[] = [];
  
  for (const other of allTasks) {
    if (other.id === task.id) continue;
    
    // Name similarity (simple word overlap)
    const similarity = calculateNameSimilarity(task.name, other.name);
    if (similarity > 0.5) {
      similar.push(other);
      continue;
    }
    
    // Tag overlap
    if (task.tags && other.tags) {
      const commonTags = task.tags.filter(t => other.tags!.includes(t));
      if (commonTags.length >= 2) {
        similar.push(other);
      }
    }
    
    // Category match
    if (task.category && task.category === other.category) {
      if (calculateNameSimilarity(task.name, other.name) > 0.3) {
        similar.push(other);
      }
    }
  }
  
  return similar;
}
```

---

### Feature 6: Delegation Suggestion 👥

**Button Text:** "Check Delegation" (requires "Analyze All")  
**Trigger Conditions:**
- Average delay > 60 minutes for tasks with same tag

**Result Display:**
```
👥 Delegation Recommended (70% confidence)
Tasks with tag #admin are often delayed by 2.5 hours.
Suggestion: Consider delegating or reassigning
[Apply] [Dismiss]
```

**Implementation:**
```typescript
detectDelegationOpportunity(tasks: Task[]): Map<string, number> {
  const tagDelayMap = new Map<string, number[]>();
  
  for (const task of tasks) {
    if (task.tags && task.completionContexts) {
      for (const tag of task.tags) {
        if (!tagDelayMap.has(tag)) {
          tagDelayMap.set(tag, []);
        }
        const delays = task.completionContexts
          .filter(c => c.delayMinutes !== undefined)
          .map(c => c.delayMinutes!);
        tagDelayMap.get(tag)!.push(...delays);
      }
    }
  }
  
  const results = new Map<string, number>();
  for (const [tag, delays] of tagDelayMap) {
    if (delays.length >= 5) {
      const avgDelay = delays.reduce((a, b) => a + b, 0) / delays.length;
      if (avgDelay > 60) {
        results.set(tag, avgDelay);
      }
    }
  }
  
  return results;
}
```

---

## 🎯 BLOCK ACTIONS EDITOR SPECS

**Purpose:** Define smart actions triggered by SiYuan block events

### Trigger Types (When)

| Trigger | Description | Parameters |
|---------|-------------|------------|
| `blockCompleted` | Block marked as done | None |
| `blockDeleted` | Block deleted | None |
| `blockEmpty` | Block becomes empty | None |
| `blockMoved` | Block moved | None |
| `blockCollapsed` | Block collapsed | None |
| `blockExpanded` | Block expanded | None |
| `contentMatches` | Content matches regex | `regex: string` |
| `contentNotMatches` | Content doesn't match | `regex: string` |
| `contentHasTag` | Content has tag | `tag: string` |
| `contentHasKeyword` | Content has keyword | `keyword: string` |

### Action Types (Then)

| Action | Description | Parameters |
|--------|-------------|------------|
| `setStatus` | Set task status | `status: 'done' \| 'in_progress' \| 'cancelled'` |
| `triggerNextRecurrence` | Trigger next occurrence | None |
| `pauseRecurrence` | Pause recurrence | None |
| `changePriority` | Change priority | `priority: TaskPriority` |
| `addTag` | Add tag | `tag: string` |
| `removeTag` | Remove tag | `tag: string` |
| `addCompletionNote` | Add note | `note: string` |
| `sendWebhook` | Send webhook | `url: string` |
| `notify` | Send notification | `message: string` |

### Example Block Action

```typescript
{
  id: "action-123",
  trigger: { type: "blockCompleted" },
  action: { type: "triggerNextRecurrence" },
  enabled: true
}
```

**UI Requirements:**
- Add/Remove actions
- Enable/Disable toggles
- Human-readable descriptions
- Prevent infinite action loops

---

## 📅 DASHBOARD FEATURES

**Location:** End of dashboard view (separate from modal)

### 1. Calendar Button

**Button Text:** "📅 Open Calendar"  
**Behavior:**
- Opens day/week/month view
- Click day → shows tasks for that day
- Click task → opens TaskEditorModal

### 2. Tracker & Analytics Button

**Button Text:** "📊 Tracker & Analytics"  
**Displays:**
- **Completion Rate:** % of tasks completed on time
- **Miss Rate:** % of tasks missed
- **Streaks:** Current and best completion streaks
- **Time-of-Day Heatmap:** When tasks are usually completed (can be stub for now)

---

## 🔧 TECHNICAL IMPLEMENTATION GUIDE

### Required File Structure

```
src/
├── adapters/
│   └── TaskModelAdapter.ts          ✅ CREATED (unifies Obsidian/SiYuan models)
├── ui/
│   ├── EditTask.svelte              ⚠️ NEEDS INTEGRATION (main modal)
│   ├── AISuggestionsPanel.svelte    ✅ CREATED (AI features)
│   ├── BlockActionsEditor.svelte    ✅ CREATED (block actions)
│   ├── TagsCategoryEditor.svelte    ✅ CREATED (tags/category)
│   ├── RecurrencePreview.svelte     ✅ CREATED (next 5 dates)
│   ├── DateEditor.svelte            ✅ EXISTS (working)
│   ├── PriorityEditor.svelte        ✅ EXISTS (working)
│   ├── StatusEditor.svelte          ✅ EXISTS (working)
│   ├── RecurrenceEditor.svelte      ✅ EXISTS (working)
│   └── Dependency.svelte            ✅ EXISTS (working)
├── core/
│   ├── ai/
│   │   └── SmartSuggestionEngine.ts ✅ EXISTS (all 6 AI features)
│   ├── models/
│   │   └── Task.ts                  ✅ EXISTS (SiYuan model)
│   └── block-actions/
│       └── BlockActionTypes.ts      ✅ EXISTS (types defined)
└── shehab/
    └── TaskModal.ts                 ⚠️ NEEDS UPDATE (modal wrapper)
```

### Integration Steps

#### Step 1: Update EditTask.svelte

**File:** `src/ui/EditTask.svelte`

Add these imports at the top:
```typescript
import AISuggestionsPanel from './AISuggestionsPanel.svelte';
import BlockActionsEditor from './BlockActionsEditor.svelte';
import TagsCategoryEditor from './TagsCategoryEditor.svelte';
import RecurrencePreview from './RecurrencePreview.svelte';
import { TaskModelAdapter, type UnifiedTask } from '@/adapters/TaskModelAdapter';
import type { TaskSuggestion } from '@/core/ai/SmartSuggestionEngine';
```

Convert task to unified format:
```typescript
let unifiedTask = TaskModelAdapter.toUnified(task);
```

Add after existing dependencies section:
```svelte
<!-- Tags & Category -->
<TagsCategoryEditor
  tags={unifiedTask.tags || []}
  category={unifiedTask.category || ''}
  onChange={(tags, category) => {
    unifiedTask.tags = tags;
    unifiedTask.category = category;
  }}
/>

<!-- Recurrence Preview -->
{#if editableTask.recurrence}
  <RecurrencePreview
    frequency={unifiedTask.frequency}
    startDate={unifiedTask.dueAt}
    previewCount={5}
  />
{/if}

<!-- Block Actions -->
<BlockActionsEditor
  actions={unifiedTask.blockActions || []}
  onChange={(actions) => {
    unifiedTask.blockActions = actions;
  }}
/>

<!-- AI Suggestions Panel -->
<AISuggestionsPanel
  task={unifiedTask}
  allTasks={allTasks.map(t => TaskModelAdapter.toUnified(t))}
  onApplySuggestion={handleApplySuggestion}
/>
```

Add suggestion handler:
```typescript
function handleApplySuggestion(suggestion: TaskSuggestion) {
  switch (suggestion.action.type) {
    case 'disable':
      unifiedTask.enabled = false;
      break;
    case 'updateTime':
      const newDue = moment(unifiedTask.dueAt);
      newDue.hour(suggestion.action.parameters.hour);
      unifiedTask.dueAt = newDue.toISOString();
      break;
    case 'setPriority':
      unifiedTask.priority = suggestion.action.parameters.priority;
      editableTask.priority = suggestion.action.parameters.priority;
      break;
    case 'adjustFrequency':
      // Update frequency based on suggestion
      break;
  }
}
```

#### Step 2: Fix Import Paths

**Find and replace globally:**
```typescript
// WRONG
import { Plugin } from '1';
import { ... } from '1/...';

// CORRECT
import type { Plugin } from 'siyuan';
import { ... } from '@/...'; // or proper module path
```

#### Step 3: Add Circular Dependency Check

**File:** `src/ui/Dependency.svelte` or create new validator

```typescript
export function hasCircularDependency(
  taskId: string,
  dependsOn: string[],
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  
  function visit(id: string): boolean {
    if (visited.has(id)) return true;
    visited.add(id);
    
    const task = allTasks.find(t => t.id === id);
    if (!task) return false;
    
    for (const depId of task.dependsOn || []) {
      if (depId === taskId) return true;
      if (visit(depId)) return true;
    }
    
    visited.delete(id);
    return false;
  }
  
  return dependsOn.some(depId => visit(depId));
}
```

Use in dependency picker:
```typescript
function addDependency(taskId: string) {
  const newDeps = [...editableTask.dependsOn, taskId];
  
  if (hasCircularDependency(task.id, newDeps, allTasks)) {
    alert('Cannot add dependency: would create circular reference');
    return;
  }
  
  editableTask.dependsOn = newDeps;
}
```

---

## ✅ VALIDATION RULES

### Date Validation
```typescript
function validateDates(task: UnifiedTask): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const start = task.startAt ? new Date(task.startAt) : null;
  const scheduled = task.scheduledAt ? new Date(task.scheduledAt) : null;
  const due = task.dueAt ? new Date(task.dueAt) : null;
  
  if (start && scheduled && start > scheduled) {
    errors.push('Start date cannot be after scheduled date');
  }
  
  if (start && due && start > due) {
    errors.push('Start date cannot be after due date');
  }
  
  if (scheduled && due && scheduled > due) {
    errors.push('Scheduled date cannot be after due date');
  }
  
  return { valid: errors.length === 0, errors };
}
```

### Required Fields
```typescript
function validateRequired(task: UnifiedTask): boolean {
  return !!(task.name && task.name.trim());
}
```

---

## 🎨 UI/UX REQUIREMENTS

### Modal Appearance
- **Width:** 800px (responsive on mobile)
- **Max Height:** 90vh with scroll
- **Style:** Follow SiYuan's theme (var(--background-primary), etc.)
- **Buttons:** "Apply" should be accent color, "Cancel" should be muted

### AI Panel Appearance
- **Background:** Slightly different from modal (var(--background-secondary))
- **Border:** Left border with accent color for active suggestions
- **Confidence Colors:**
  - High (≥80%): Green (var(--text-success))
  - Medium (60-79%): Orange (var(--text-warning))
  - Low (<60%): Gray (var(--text-muted))

### Block Actions Appearance
- **Disabled Actions:** 50% opacity
- **Action Flow:** Trigger → (arrow) → Action
- **Buttons:** Enable/disable toggle, remove button

---

## 🚨 CRITICAL RULES

### DO NOT:
- ❌ Auto-apply AI suggestions without user confirmation
- ❌ Allow circular dependencies
- ❌ Allow start > due date
- ❌ Create infinite block action loops
- ❌ Use `any` type in TypeScript
- ❌ Break existing working features

### DO:
- ✅ Show confirmation dialogs before destructive actions
- ✅ Validate all inputs before saving
- ✅ Use TypeScript strict mode
- ✅ Preserve existing task data (lossless editing)
- ✅ Show clear error messages
- ✅ Test with large task sets (100+ tasks)

---

## 🧪 TESTING CHECKLIST

Before marking complete, verify:

- [ ] Modal opens when clicking task icon
- [ ] All fields persist correctly
- [ ] Date validation works (start ≤ scheduled ≤ due)
- [ ] Circular dependency prevented
- [ ] AI suggestions generate correctly
- [ ] AI suggestions require user approval
- [ ] Block actions can be added/removed
- [ ] Tags can be added/removed
- [ ] Recurrence preview shows 5 dates
- [ ] "Apply" saves all changes
- [ ] "Cancel" discards all changes
- [ ] No TypeScript errors
- [ ] No console errors at runtime

---

## 📊 SUCCESS METRICS

**Plugin is complete when:**
1. ✅ TaskEditorModal has all 10 sections working
2. ✅ All 6 AI features generate suggestions
3. ✅ Block actions can be created and edited
4. ✅ Calendar button opens calendar view
5. ✅ Tracker button shows analytics
6. ✅ No errors in console
7. ✅ TypeScript compiles without errors
8. ✅ User can create, edit, and save tasks end-to-end

---

## 📦 DELIVERABLES

**Expected Output:**
1. Fixed `EditTask.svelte` with all new components integrated
2. Fixed `TaskModal.ts` with unified task support
3. Fixed import paths (no more `from '1'`)
4. Added circular dependency validation
5. Calendar view integration (basic)
6. Tracker & analytics view (basic)
7. All TypeScript errors resolved
8. Documentation of any breaking changes

---

## 💡 HINTS FOR AI AGENT

- **Files already created:** TaskModelAdapter, AISuggestionsPanel, BlockActionsEditor, TagsCategoryEditor, RecurrencePreview
- **Files need updating:** EditTask.svelte, TaskModal.ts
- **Main work:** Wire new components into existing modal
- **Existing components work:** Don't break DateEditor, PriorityEditor, StatusEditor, RecurrenceEditor, Dependency
- **AI engine exists:** SmartSuggestionEngine has all logic, just needs UI integration
- **Architecture is solid:** TaskManager, TaskStorage, TaskRepository all work
- **Focus on:** Integration, not rewriting

---

**START CODING NOW. FIX AND COMPLETE THE PLUGIN.**
