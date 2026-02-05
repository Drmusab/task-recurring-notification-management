# Query Presets Tutorial

Query Presets allow you to save and reuse complex query configurations for quick access to your most important task views.

## What are Query Presets?

A Query Preset is a saved query configuration that includes:
- **Name**: A descriptive title for the preset
- **Query**: The filter/sort/group commands
- **Description**: Optional explanation of what the preset shows
- **Icon**: Optional emoji or icon for visual identification
- **Color**: Optional color for visual distinction

## Built-in Presets

The plugin comes with 7 pre-configured presets:

### 1. Today's Focus 🎯
**Purpose**: Show your top 10 urgent tasks due today  
**Query**:
```
filter status is todo
filter due today
sort urgency
limit 10
```
**Use Case**: Start your day by reviewing your most important tasks

### 2. This Week 📅
**Purpose**: All tasks due this week, grouped by priority  
**Query**:
```
filter status is todo
filter due after today
filter due before 7 days
group by priority
sort due
```
**Use Case**: Weekly planning and scheduling

### 3. Overdue ⚠️
**Purpose**: Past-due tasks sorted by urgency  
**Query**:
```
filter status is todo
filter due before today
sort urgency
show urgency
```
**Use Case**: Catch up on missed deadlines

### 4. Waiting on Others ⏳
**Purpose**: Tasks blocked by dependencies  
**Query**:
```
filter status is todo
filter has dependencies
filter is blocked
group by dependency
```
**Use Case**: Follow up on tasks waiting for others

### 5. High Priority 🔴
**Purpose**: All high and highest priority tasks  
**Query**:
```
filter status is todo
filter priority >= high
sort urgency
```
**Use Case**: Focus on critical tasks

### 6. Upcoming 📆
**Purpose**: Tasks scheduled for the next 30 days  
**Query**:
```
filter status is todo
filter due after today
filter due before 30 days
sort due
```
**Use Case**: Long-term planning

### 7. No Due Date 📝
**Purpose**: Tasks without a due date  
**Query**:
```
filter status is todo
filter not has due
sort priority
```
**Use Case**: Backlog management

## Creating Custom Presets

### Via Code

```typescript
import { PresetManager } from '@/core/query/PresetManager';
import { createQueryPreset } from '@/core/query/QueryPreset';

// Create a preset manager
const presetManager = new PresetManager(plugin);
await presetManager.initialize();

// Create a custom preset
const myPreset = await presetManager.createPreset(
  'My Work Tasks',
  `filter status is todo
filter tag includes #work
sort due`,
  {
    description: 'All my work-related tasks',
    icon: '💼',
    color: '#4ECDC4'
  }
);
```

### Preset Properties

| Property | Required | Description | Example |
|----------|----------|-------------|---------|
| `name` | Yes | Display name | "My Work Tasks" |
| `query` | Yes | Query string | "filter status is todo" |
| `description` | No | Explanation | "All work tasks due this week" |
| `icon` | No | Emoji or icon | "💼" or "work" |
| `color` | No | Hex color | "#4ECDC4" |

## Managing Presets

### Search Presets

```typescript
const results = presetManager.searchPresets('overdue');
// Returns presets matching "overdue" in name, description, or query
```

### Get Preset by ID

```typescript
const preset = presetManager.getPresetById('today-focus');
```

### Update a Preset

```typescript
await presetManager.updatePreset('my-preset-id', {
  name: 'Updated Name',
  query: 'filter status is todo\nsort priority',
  color: '#FF6B6B'
});
```

### Delete a Preset

```typescript
const deleted = await presetManager.deletePreset('my-preset-id');
// Returns true if deleted, false if not found or is built-in
```

**Note**: Built-in presets cannot be deleted.

### Duplicate a Preset

```typescript
const copy = await presetManager.duplicatePreset('today-focus');
// Creates "Today's Focus (Copy)"
```

### Reorder Presets

```typescript
const newOrder = ['preset-1', 'preset-3', 'preset-2'];
await presetManager.reorderPresets(newOrder);
```

## Import/Export

### Export Single Preset (Base64)

```typescript
import { exportPreset } from '@/core/query/QueryPreset';

const encoded = exportPreset(myPreset);
// Share this string with others
```

### Import Single Preset

```typescript
import { importPreset } from '@/core/query/QueryPreset';

const preset = importPreset(encodedString);
if (preset) {
  await presetManager.createPreset(
    preset.name,
    preset.query,
    { description: preset.description, icon: preset.icon, color: preset.color }
  );
}
```

### Export All Presets (JSON)

```typescript
import { exportPresetsToJSON } from '@/core/query/QueryPreset';

const allPresets = presetManager.exportPresets();
const json = exportPresetsToJSON(allPresets);
// Save to file or share
```

### Import Presets from JSON

```typescript
import { importPresetsFromJSON } from '@/core/query/QueryPreset';

const presets = importPresetsFromJSON(jsonString);
await presetManager.importPresets(presets, true); // true = merge, false = replace
```

## Query Syntax Reference

### Filters
- `filter status is todo` - Filter by status
- `filter due today` - Tasks due today
- `filter due before today` - Overdue tasks
- `filter due after today` - Future tasks
- `filter priority >= high` - High priority and above
- `filter tag includes #work` - Tasks tagged with #work
- `filter has dependencies` - Tasks with dependencies
- `filter is blocked` - Tasks blocked by dependencies

### Sorting
- `sort urgency` - Sort by urgency score
- `sort due` - Sort by due date
- `sort priority` - Sort by priority
- `sort created` - Sort by creation date

### Grouping
- `group by priority` - Group by priority level
- `group by status` - Group by status
- `group by dependency` - Group by dependency

### Limiting
- `limit 10` - Show only first 10 results

### Display
- `show urgency` - Display urgency scores

## Best Practices

### 1. Use Descriptive Names
✅ Good: "High Priority Work Tasks This Week"  
❌ Bad: "My Query 1"

### 2. Add Descriptions
```typescript
{
  name: 'Client Deliverables',
  description: 'All tasks tagged #client that are due this month',
  query: '...'
}
```

### 3. Use Icons for Quick Identification
```typescript
{
  icon: '🎯',  // For focus/priority
  icon: '📅',  // For time-based
  icon: '💼',  // For work
  icon: '🏠',  // For personal
}
```

### 4. Color Code by Context
```typescript
{
  color: '#FF6B6B',  // Red for urgent/overdue
  color: '#4ECDC4',  // Blue for work
  color: '#FFE66D',  // Yellow for pending
  color: '#A8E6CF',  // Green for upcoming
}
```

### 5. Keep Queries Simple
Focus on 2-4 filters per preset for best performance and clarity.

## Common Use Cases

### Daily Planning
```typescript
{
  name: 'Morning Review',
  query: `filter status is todo
filter due <= 3 days
sort urgency
limit 15`
}
```

### Weekly Review
```typescript
{
  name: 'Week Ahead',
  query: `filter status is todo
filter due after today
filter due before 7 days
group by priority`
}
```

### Project-Specific
```typescript
{
  name: 'Project Alpha',
  query: `filter status is todo
filter tag includes #alpha
sort due`
}
```

### Quick Wins
```typescript
{
  name: 'Quick Wins',
  query: `filter status is todo
filter priority is low
filter not has dependencies
sort due`
}
```

## Tips

1. **Start with Built-ins**: Modify built-in presets to learn the query syntax
2. **Duplicate Before Editing**: Create copies to experiment safely
3. **Share Presets**: Export useful presets to share with your team
4. **Regular Cleanup**: Delete unused custom presets periodically
5. **Backup**: Export all presets regularly to prevent data loss

## Troubleshooting

### Preset Not Showing Results
- Verify query syntax is correct
- Check that filters aren't too restrictive
- Ensure date filters use correct format

### Import Failed
- Check that the encoded string is complete
- Verify JSON structure for batch imports
- Ensure preset names don't conflict with existing ones

### Performance Issues
- Limit the number of active presets
- Simplify complex queries with many filters
- Use `limit` to reduce result set size
