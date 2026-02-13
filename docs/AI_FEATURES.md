# AI-Driven Features Documentation

## Overview

This document describes the three advanced features added to the Recurring Task Management plugin:

1. **Smart Suggestions** - AI-driven task recommendations
2. **Predictive Scheduling** - ML-based time suggestions
3. **Keyboard Navigation** - Vim-like navigation for power users

---

## Feature 1: Smart Suggestions

### Description

The Smart Suggestions engine analyzes your task completion patterns and provides actionable recommendations to improve your productivity.

### Suggestion Types

1. **Abandonment Detection** 🗑️
   - Identifies tasks that are never completed
   - Suggests removing or disabling unused tasks
   - Triggers when: 5+ misses with 0 completions, or <10% completion rate

2. **Reschedule Suggestions** ⏰
   - Analyzes when you actually complete tasks
   - Suggests better times based on historical patterns
   - Triggers when: 70%+ confidence and 2+ hour difference

3. **Urgency Alerts** ⚠️
   - Flags frequently missed tasks
   - Suggests increasing priority
   - Triggers when: 3+ consecutive misses

4. **Frequency Optimization** 📊
   - Detects when you complete tasks more often than scheduled
   - Suggests adjusting recurrence frequency
   - Triggers when: Completion rate >1.5x scheduled

5. **Consolidation** 📦
   - Finds similar tasks on the same day
   - Suggests combining them for efficiency
   - Triggers when: 3+ similar tasks same day

6. **Delegation** 👥
   - Identifies tasks consistently delayed
   - Suggests delegation based on tags
   - Triggers when: Tag average delay >60 minutes

### Usage

```typescript
import { SmartSuggestionEngine } from '@/core/ai/SmartSuggestionEngine';

const engine = new SmartSuggestionEngine();

// Analyze single task
const suggestions = await engine.analyzeTask(task, allTasks);

// Analyze all tasks for cross-task patterns
const crossSuggestions = await engine.analyzeCrossTaskPatterns(allTasks);

// Get best time prediction
const bestTime = engine.predictBestTime(task);
```

### Configuration

```typescript
// In plugin settings
smartSuggestions: {
  enabled: true,
  minConfidence: 0.65,        // Only show suggestions with 65%+ confidence
  showDismissed: false,       // Hide dismissed suggestions
  autoApplyHighConfidence: false  // Automatically apply 90%+ confidence suggestions
}
```

### Data Requirements

For accurate suggestions, the system needs:
- **Minimum 3 completions** for reschedule suggestions
- **Minimum 5 completions** for delegation patterns
- **Completion context data** (time, day, delay)

---

## Feature 2: Predictive Scheduling

### Description

The Predictive Scheduler uses a weighted scoring algorithm to suggest optimal times for scheduling tasks based on historical success, workload balance, and user preferences.

### Scoring Factors

The algorithm considers 6 factors:

1. **Historical Success** (35% weight)
   - Past completion rate at specific time slots
   - Higher score for times you've successfully completed tasks

2. **Workload Balance** (20% weight)
   - Avoids overloading specific times
   - Spreads tasks evenly throughout the day

3. **Task Density** (15% weight)
   - Considers nearby tasks
   - Prefers moderate clustering

4. **User Preference** (15% weight)
   - Respects working hours
   - Favors preferred days

5. **Energy Level** (10% weight)
   - Morning hours for high-priority tasks
   - Evening hours for low-priority tasks

6. **Context Switching** (5% weight)
   - Groups similar tasks together
   - Reduces mental overhead

### Usage

```typescript
import { PredictiveScheduler } from '@/core/ai/PredictiveScheduler';

const scheduler = new PredictiveScheduler();

// Get top 3 time suggestions
const suggestions = await scheduler.suggestBestTimes(task, 3);

// Evaluate current schedule
const evaluation = await scheduler.evaluateCurrentSchedule(task);
if (!evaluation.isOptimal) {
  console.log('Consider rescheduling to:', evaluation.bestAlternative);
}

// Score all possible time slots
const context = {
  allTasks: tasks,
  userPreferences: {
    workingHours: { start: 9, end: 17 },
    preferredDays: [1, 2, 3, 4, 5]
  },
  constraints: {
    maxTasksPerDay: 20,
    minGapBetweenTasks: 15
  }
};

const allScores = await scheduler.scoreTimeSlots(task, context);
```

### Configuration

```typescript
predictiveScheduling: {
  enabled: true,
  showHeatmap: true,         // Show weekly heatmap visualization
  minDataPoints: 5,          // Minimum completions for predictions
  workingHours: { start: 6, end: 22 },
  preferredDays: [1, 2, 3, 4, 5]  // Monday-Friday
}
```

### Continuous Learning

The `ModelTuner` tracks prediction accuracy and adjusts weights:

```typescript
import { ModelTuner } from '@/core/ai/learning/ModelTuner';

const tuner = new ModelTuner();

// Record prediction outcome
await tuner.recordOutcome(
  taskId,
  { hour: 9, dayOfWeek: 1 },
  { hour: 10, dayOfWeek: 1 },
  true
);

// Get accuracy stats
const stats = tuner.getStats();
console.log('Prediction accuracy:', stats.accuracy);

// Optimize weights based on performance
const optimizedWeights = await tuner.optimizeWeights();
```

---

## Feature 3: Vim-like Keyboard Navigation

### Description

Power users can navigate and manipulate tasks using Vim-inspired keyboard shortcuts, eliminating the need for mouse interaction.

### Modes

The navigation system has 4 modes:

1. **Normal Mode** - Default mode for navigation
2. **Insert Mode** - Edit task
3. **Visual Mode** - Select multiple tasks
4. **Command Mode** - Execute commands

### Keybindings

#### Navigation (Normal Mode)

| Key | Action |
|-----|--------|
| `j` | Move down one task |
| `k` | Move up one task |
| `gg` | Jump to first task |
| `G` | Jump to last task |
| `h` | Collapse task |
| `l` | Expand task |

#### Task Actions

| Key | Action |
|-----|--------|
| `x` | Toggle task completion |
| `dd` | Delete task |
| `yy` | Duplicate task |
| `i` | Edit task (enter insert mode) |
| `p` | Postpone 1 day |
| `P` | Postpone 1 week |
| `u` | Undo |
| `Ctrl+r` | Redo |

#### Tab Navigation

| Key | Action |
|-----|--------|
| `gt` | Next tab |
| `gT` | Previous tab |
| `1gt` - `9gt` | Go to specific tab |

#### Mode Switching

| Key | Action |
|-----|--------|
| `v` | Enter visual mode |
| `:` | Enter command mode |
| `Esc` | Return to normal mode |

#### Search

| Key | Action |
|-----|--------|
| `/` | Start search |
| `n` | Next search result |
| `N` | Previous search result |

#### Filters

| Key | Action |
|-----|--------|
| `fp` | Filter by priority |
| `ft` | Filter today's tasks |
| `fo` | Filter overdue |
| `fc` | Clear all filters |

### Command Mode

Press `:` to enter command mode, then type commands:

| Command | Description | Arguments |
|---------|-------------|-----------|
| `:sort` | Sort tasks | `due`, `priority`, `created`, `modified`, `name` |
| `:filter` | Filter tasks | `priority:high`, `status:todo`, `tag:work` |
| `:goto` | Jump to task | Task name |
| `:export` | Export tasks | `json`, `csv`, `markdown` |
| `:tab` | Switch tab | Tab name |
| `:help` | Show help | - |
| `:clear` | Clear filters | - |

Examples:
- `:sort priority` - Sort by priority
- `:filter tag:urgent` - Show only urgent tasks
- `:goto Review meeting notes` - Jump to specific task
- `:export json` - Export to JSON

### Usage

```typescript
import { KeyboardNavigationController } from '@/core/navigation/KeyboardNavigationController';
import { CommandPalette } from '@/core/navigation/CommandPalette';

// Initialize controller
const controller = new KeyboardNavigationController();
controller.setMaxTaskIndex(tasks.length);

// Listen to events
controller.on('selectionChange', (index) => {
  scrollToTask(index);
});

controller.on('action', (action) => {
  switch (action.type) {
    case 'toggleComplete':
      toggleTaskCompletion(action.index);
      break;
    case 'deleteTask':
      deleteTask(action.index);
      break;
    // ... handle other actions
  }
});

// Handle keyboard events
window.addEventListener('keydown', (e) => {
  if (controller.handleKey(e)) {
    e.preventDefault();
  }
});

// Initialize command palette
const palette = new CommandPalette();

palette.setCommandCallback('sort', (sortBy) => {
  sortTasks(sortBy);
});

palette.setCommandCallback('filter', (query) => {
  applyFilter(query);
});

// Execute command
await palette.executeCommand('sort due');
```

### Configuration

```typescript
keyboardNavigation: {
  enabled: false,              // Opt-in feature
  useVimKeybindings: true,     // Use Vim-style keybindings
  customKeybindings: {},       // Override default keybindings
  showModeIndicator: true,     // Show mode bar at bottom
  showQuickHints: true,        // Show keyboard hints
  enableCommandPalette: true   // Enable command mode
}
```

### Visual Feedback

When enabled, a mode indicator appears at the bottom of the screen showing:
- Current mode
- Command buffer (in command mode)
- Selected count (in visual mode)
- Quick hints for available actions

---

## Privacy & Performance

### Local Processing
All ML/AI processing happens locally. No data is sent to external servers.

### Data Retention
- Completion history is stored for pattern analysis
- Raw completion data is retained for 90 days
- Only aggregated statistics are kept long-term

### Performance
- Suggestion generation: <200ms
- Keyboard navigation: <16ms per keypress
- Predictive scoring: <100ms for 168 time slots (24h × 7 days)

---

## Testing

Run tests with:

```bash
# All tests
npm test

# Specific feature tests
npm test src/core/ai/__tests__/smart-suggestion-engine.test.ts
npm test src/core/navigation/__tests__/keyboard-navigation.test.ts
```

Test coverage:
- SmartSuggestionEngine: 15 tests
- KeyboardNavigationController: 23 tests
- All tests passing ✅

---

## Future Enhancements

Potential improvements for future versions:

1. **Smart Suggestions**
   - Machine learning for suggestion ranking
   - User feedback loop to improve accuracy
   - Collaborative filtering across users (opt-in)

2. **Predictive Scheduling**
   - Neural network for time prediction
   - Integration with calendar events
   - Weather and location-based suggestions

3. **Keyboard Navigation**
   - Macro recording and playback
   - Custom keybinding profiles
   - Voice command integration

---

## Support

For issues or questions:
- GitHub Issues: https://github.com/Drmusab/recurring-task-management/issues
- Documentation: See README.md in repository root
