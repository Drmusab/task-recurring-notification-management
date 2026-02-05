# Phase 3 Advanced Features Documentation

## Overview

Phase 3 introduces three strategic differentiating features that leverage AI/ML capabilities and knowledge graph integration to position the plugin as a next-generation task management system:

1. **Smart Recurrence** - ML-based pattern learning
2. **Natural Language Input** - Create tasks using plain English
3. **Cross-Note Dependencies** - Knowledge graph-aware task management

---

## Feature 1: Smart Recurrence (ML-Based Pattern Learning)

### Overview

The Smart Recurrence feature learns from your task completion patterns and automatically suggests schedule optimizations to align tasks with your natural working habits.

### Key Components

#### PatternLearner (`src/core/ml/PatternLearner.ts`)

The core ML engine that analyzes completion history and generates insights.

**Classes:**
- `SmartRecurrenceEngine` - Main engine for pattern analysis
- `PatternAnalyzer` - Statistical analysis utilities

**Key Methods:**
- `analyzeCompletionPatterns(task)` - Generate insights from completion history
- `suggestScheduleOptimization(task)` - Suggest schedule adjustments
- `autoAdjustSchedule(task, threshold)` - Automatically apply suggestions
- `detectAnomalies(task)` - Find problematic patterns

### How It Works

#### 1. Data Collection

When smart recurrence is enabled on a task, the system automatically tracks:
- Scheduled time vs actual completion time
- Day of week patterns
- Delay in minutes
- Related context (tags, blocks)

This data is stored in `task.completionHistory[]`:

```typescript
interface CompletionHistoryEntry {
  scheduledFor: string;
  completedAt: string;
  delayMinutes: number;
  dayOfWeek: number;
  context: {
    location?: string;
    tags: string[];
    relatedBlocks: string[];
  };
}
```

#### 2. Pattern Analysis

After collecting at least 10 completions, the engine analyzes:

- **Average Delay**: How much earlier/later you typically complete tasks
- **Preferred Time**: Which hour you most often complete tasks
- **Weekday Patterns**: Which days you're most consistent
- **Consistency Score**: How predictable your completion times are
- **Miss Rate**: Percentage of tasks you skip

#### 3. Insights Generation

The engine generates a `CompletionInsight` with:

```typescript
interface CompletionInsight {
  averageCompletionDelay: number;  // minutes
  preferredTimeOfDay: number;       // hour (0-23)
  preferredDayOfWeek: number[];     // preferred days
  completionConsistency: number;    // 0-1 score
  missedTaskFrequency: number;      // percentage
  suggestedAdjustment: string;      // human-readable
  confidence: number;                // 0-1
}
```

#### 4. Schedule Optimization

When patterns are strong enough (confidence > 0.5), the engine suggests schedule adjustments:

```typescript
interface ScheduleSuggestion {
  currentSchedule: {
    frequency: Frequency;
    time?: string;
  };
  suggestedSchedule: {
    frequency: Frequency;
    time?: string;
  };
  reason: string;
  confidence: number;
  expectedImprovement: string;
}
```

### Using Smart Recurrence

#### Enable for a Task

```typescript
task.smartRecurrence = {
  enabled: true,
  autoAdjust: false,  // Manual approval required
  minDataPoints: 10,
  confidenceThreshold: 0.7
};
```

#### View Insights

Navigate to the **Insights** tab in the dashboard to:
- View completion patterns for all smart tasks
- See suggested schedule optimizations
- Apply suggestions with one click
- Monitor anomalies and issues

#### Automatic Adjustment

Enable auto-adjustment for fully automated scheduling:

```typescript
task.smartRecurrence.autoAdjust = true;
```

The system will automatically update the schedule when:
- Confidence threshold is met (default: 0.7)
- At least minimum data points collected
- A meaningful improvement is expected

### Anomaly Detection

The system automatically detects:

1. **Consistently Skipped Tasks** - Tasks missed >50% of the time
2. **Completion Drift** - Tasks completed increasingly earlier/later
3. **Irregular Completion** - High variance in completion times

Detected anomalies are displayed in the Insights tab with suggestions for resolution.

### Configuration

Update settings in `PluginSettings`:

```typescript
smartRecurrence: {
  enabled: true,
  autoAdjust: false,
  minCompletionsForLearning: 10,
  confidenceThreshold: 0.7
}
```

---

## Feature 2: Natural Language Input

### Overview

Create recurring tasks using natural language instead of complex configuration dialogs.

### Supported Patterns

The parser understands over 20 common patterns:

#### Daily Patterns
- "every day"
- "every 2 days"
- "daily"

#### Weekly Patterns
- "every weekday at 9am"
- "every Monday at 2pm"
- "every 2 weeks on Friday"
- "every week on Monday and Wednesday"

#### Monthly Patterns
- "every 15th"
- "every 1st and 15th"
- "every 1st Monday"
- "every last Friday of the month"
- "end of month"

#### Complex Patterns
- "every 2 weeks on Monday and Wednesday"
- "every 3rd Tuesday"
- "on the 1st and 15th"

### How It Works

#### Parser Architecture

The `NaturalLanguageParser` uses multiple parsing strategies:

1. **Ordinal Day Parser** - Handles "every 2nd Tuesday"
2. **Compound Frequency Parser** - Handles "every 2 weeks on Mon and Wed"
3. **Relative Date Parser** - Handles "in 3 days", "next Monday"
4. **Month-Aware Parser** - Handles "every 15th"
5. **Base Parser Fallback** - Uses `NaturalRecurrenceParser` for common patterns

#### Confidence Scoring

Each parse result includes a confidence score (0-1):
- 0.95+ - Ordinal patterns ("every 2nd Tuesday")
- 0.9+ - Compound patterns ("every 2 weeks on Monday")
- 0.85+ - Month-aware patterns ("every 15th")
- 0.7+ - Base parser patterns

#### Parse Result

```typescript
interface ParseResult {
  frequency?: Frequency;
  naturalLanguage?: string;
  confidence: number;
  alternatives?: Frequency[];  // Other interpretations
  errors?: string[];
}
```

### Using Natural Language Input

#### UI Component

The `NaturalLanguageInput` component provides:
- Live parsing feedback
- Confidence score display
- Example patterns
- Error messages
- Preview of parsed pattern

#### Integration Example

```svelte
<NaturalLanguageInput
  onTaskCreated={(partialTask) => {
    // partialTask includes:
    // - name: The natural language input
    // - frequency: Parsed recurrence pattern
    // - recurrenceText: Original input for reference
  }}
/>
```

#### Programmatic Usage

```typescript
import { NaturalLanguageParser } from '@backend/core/parsers/NaturalLanguageParser';

const parser = new NaturalLanguageParser();
const result = parser.parse('every weekday at 9am');

if (result.confidence > 0.7) {
  const task = {
    name: 'My Task',
    frequency: result.frequency,
    recurrenceText: 'every weekday at 9am'
  };
}
```

### Configuration

```typescript
naturalLanguage: {
  enabled: true,
  showConfidenceScore: true,
  provideExamples: true
}
```

---

## Feature 3: Cross-Note Dependencies

### Overview

Create dependencies between tasks and SiYuan notes/blocks, enabling knowledge graph-aware task management.

### Dependency Types

#### 1. Block Exists
Task depends on the existence of a specific block:

```typescript
{
  type: 'blockExists',
  target: { blockId: '20250121-abc123' },
  condition: { operator: 'exists' }
}
```

#### 2. Block Content
Task depends on block content matching a condition:

```typescript
{
  type: 'blockContent',
  target: { blockId: '20250121-abc123' },
  condition: { 
    operator: 'contains', 
    value: 'APPROVED',
    caseSensitive: false
  }
}
```

#### 3. Note Attribute
Task depends on a custom block attribute:

```typescript
{
  type: 'noteAttribute',
  target: { 
    blockId: '20250121-abc123',
    attribute: 'status'
  },
  condition: { operator: 'equals', value: 'completed' }
}
```

#### 4. Tag Presence
Task depends on a tag being present:

```typescript
{
  type: 'tagPresence',
  target: { tag: 'important' },
  condition: { operator: 'exists' }
}
```

#### 5. Backlink Count
Task depends on number of backlinks:

```typescript
{
  type: 'backlinks',
  target: { blockId: '20250121-abc123' },
  condition: { operator: 'greaterThan', value: 5 }
}
```

### Condition Operators

- `exists` - Target must exist
- `equals` - Value must equal target
- `contains` - Value must contain substring
- `greaterThan` - Numeric comparison
- `lessThan` - Numeric comparison
- `matches` - Regex pattern match

### How It Works

#### Dependency Checker

The `CrossNoteDependencyChecker` evaluates dependencies:

```typescript
const checker = new CrossNoteDependencyChecker(siyuanAPI);

// Check single dependency
const isMet = await checker.checkDependency(dependency);

// Check all task dependencies
const results = await checker.checkAllDependencies(task);
```

#### Block Watcher

The `SiYuanBlockWatcher` monitors blocks for changes:

```typescript
const watcher = new SiYuanBlockWatcher(siyuanAPI);

// Watch a block
const cleanup = watcher.watchBlock(blockId, (block) => {
  console.log('Block updated:', block);
});

// Stop watching
cleanup();
```

#### Real-time Monitoring

Dependencies can be monitored in real-time:

```typescript
const stopWatching = checker.watchDependencies(task, (status) => {
  // status is a Map<dependencyId, boolean>
  console.log('Dependency status updated:', status);
});
```

### Using Cross-Note Dependencies

#### UI Component

The `DependencyManager` component provides:
- Visual list of dependencies
- Status indicators (met/unmet/checking)
- Add/remove dependencies
- Manual re-check
- Check all button

#### Adding Dependencies

```svelte
<DependencyManager
  {task}
  {siyuanAPI}
  onUpdate={(updatedTask) => {
    // Save updated task
  }}
/>
```

#### Dependency Status

Dependencies have three states:
- `met` ✓ (green) - Condition is satisfied
- `unmet` ✗ (red) - Condition is not satisfied
- `checking` ? (orange) - Currently being checked

### Configuration

```typescript
crossNoteDependencies: {
  enabled: true,
  checkInterval: 5,  // minutes
  notifyWhenMet: true
}
```

---

## Dashboard Integration

### Insights Tab

Access smart recurrence insights:

1. Navigate to **💡 Insights** tab
2. View insights for all tasks with smart recurrence enabled
3. See suggestions for schedule optimization
4. Apply suggestions with one click
5. Monitor anomalies and completion patterns

The Insights tab displays:
- **Consistency Score** - How predictable completions are
- **Average Delay** - How much earlier/later you complete
- **Preferred Time** - Most common completion hour
- **Completion Rate** - Success percentage
- **Suggestions** - Actionable schedule improvements
- **Anomalies** - Detected issues with recommendations

### Quick Filters

Quick filters work across all tabs (except Insights, Timeline, Analytics):
- Not Done
- Due Today
- Overdue
- In Progress
- Blocked
- Blocking
- High Priority

---

## API Reference

### SmartRecurrenceEngine

```typescript
class SmartRecurrenceEngine {
  analyzeCompletionPatterns(task: Task): CompletionInsight;
  suggestScheduleOptimization(task: Task): ScheduleSuggestion | null;
  autoAdjustSchedule(task: Task, threshold?: number): boolean;
  detectAnomalies(task: Task): Anomaly[];
}
```

### NaturalLanguageParser

```typescript
class NaturalLanguageParser {
  parse(text: string): ParseResult;
}
```

### CrossNoteDependencyChecker

```typescript
class CrossNoteDependencyChecker {
  constructor(siyuanAPI: SiYuanApiAdapter);
  
  checkDependency(dep: CrossNoteDependency): Promise<boolean>;
  checkAllDependencies(task: Task): Promise<Map<string, boolean>>;
  watchDependencies(
    task: Task,
    callback: (status: Map<string, boolean>) => void
  ): () => void;
  suggestDependencies(task: Task): Promise<CrossNoteDependency[]>;
}
```

### SiYuanBlockWatcher

```typescript
class SiYuanBlockWatcher {
  constructor(siyuanAPI: SiYuanApiAdapter);
  
  watchBlock(blockId: string, callback: (block: Block) => void): () => void;
  getBlockContent(blockId: string): Promise<string | null>;
  getBlockAttribute(blockId: string, attr: string): Promise<string | null>;
  getBacklinks(blockId: string): Promise<Block[]>;
  queryBlocks(sql: string): Promise<Block[]>;
}
```

---

## Testing

### Unit Tests

All Phase 3 features include comprehensive unit tests:

```bash
# Run all tests
npm test

# Run ML tests only
npm test -- src/core/ml

# Run parser tests
npm test -- src/core/parsers
```

### Test Coverage

- **Pattern Learner**: 14/14 tests passing
- **Natural Language Parser**: Existing tests passing
- **Overall**: 779/815 tests passing

---

## Performance Considerations

### Smart Recurrence
- Completion history limited to 100 entries per task
- Analysis runs only when viewing Insights tab
- Auto-adjustment checks run on task completion

### Natural Language Parsing
- Parsing is synchronous and completes in <10ms
- Multiple parsing strategies for accuracy
- No external dependencies

### Cross-Note Dependencies
- Default check interval: 5 minutes
- Polling-based (no real-time SiYuan events yet)
- Caching to minimize API calls

---

## Future Enhancements

### Smart Recurrence
- Machine learning models (neural networks)
- Context-aware scheduling (location, calendar events)
- Team pattern learning
- Predictive analytics

### Natural Language
- More complex patterns
- Holiday detection
- Time zones in input
- Multi-language support

### Dependencies
- Real-time SiYuan event integration
- Dependency graph visualization
- Circular dependency detection
- Bulk dependency operations

---

## Troubleshooting

### Smart Recurrence Not Working

**Problem**: No insights showing
**Solution**: 
- Ensure `smartRecurrence.enabled = true`
- Complete tasks at least 10 times
- Check that completion history is being tracked

### Natural Language Parse Errors

**Problem**: Pattern not recognized
**Solution**:
- Check example patterns in UI
- Verify pattern matches supported format
- Check confidence score
- Try simpler pattern first

### Dependencies Always Unmet

**Problem**: Dependencies show as unmet
**Solution**:
- Verify block IDs are correct
- Check SiYuan API connection
- Manually re-check dependencies
- Review dependency conditions

---

## Migration Guide

### Enabling Features on Existing Tasks

```typescript
// Enable smart recurrence
task.smartRecurrence = {
  enabled: true,
  autoAdjust: false,
  minDataPoints: 10,
  confidenceThreshold: 0.7
};

// Add cross-note dependency
task.crossNoteDependencies = [{
  id: generateId(),
  type: 'blockExists',
  target: { blockId: '...' },
  condition: { operator: 'exists' },
  status: 'checking',
  lastChecked: new Date().toISOString()
}];
```

### Backward Compatibility

All Phase 3 features are optional and backward compatible:
- Existing tasks work without modification
- New fields are optional
- Default settings maintain current behavior

---

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/Drmusab/recurring-task-management/issues
- Documentation: https://github.com/Drmusab/recurring-task-management/docs

---

## License

MIT License - See LICENSE file for details
