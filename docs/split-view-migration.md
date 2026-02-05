# Split-View Migration Guide

## For Plugin Developers

### Quick Start

```typescript
import DashboardSplitView from '@/components/dashboard/DashboardSplitView.svelte';

// Mount split-view dashboard
const dashboard = mount(DashboardSplitView, {
  target: container,
  props: {
    tasks: myTasks,
    statusOptions: StatusRegistry.getInstance().registeredStatuses,
    onTaskSaved: (updatedTask) => {
      // Handle save
    },
  },
});
```

### Migrating from Legacy Dashboard

**Before (Legacy):**
```typescript
this.mountEditor(container);
this.mountTaskList(listContainer);

// Separate components, manual state sync
```

**After (Split-View):**
```typescript
this.mountSplitView(container);

// Single component, automatic state sync via selectedTaskStore
```

### Feature Flag Integration

The RecurringDashboardView automatically checks the feature flag:

```typescript
const settings = this.props.settingsService.get();

if (settings.splitViewDashboard?.useSplitViewDashboard) {
  this.mountSplitView(initialTask);
} else {
  this.mountLegacyDashboard(initialTask);
}
```

### Breaking Changes

**None!** The split-view is opt-in via feature flag. Existing users continue with the legacy dashboard unless they explicitly enable split-view in settings.

### New Settings

```typescript
export interface SplitViewDashboardSettings {
  useSplitViewDashboard: boolean;  // Enable split-view
  splitViewRatio: number;          // 0.4 = 40% list, 60% editor
  autoSaveDelay: number;           // milliseconds (default 500)
}
```

### State Management

The split-view uses a centralized store for task selection:

```typescript
import { selectedTaskStore, selectTask, clearSelection } from '@/stores/selectedTask';

// Select a task
selectTask(task);

// Clear selection
clearSelection();

// Subscribe to changes
$: currentTask = $selectedTaskStore;
```

### Auto-Save Implementation

The TaskEditorPane component handles auto-save:

```typescript
import { debounce } from '@/utils/debounce';

const settings = settingsService.get();
const autoSaveDelay = settings.splitViewDashboard?.autoSaveDelay ?? 500;

const debouncedSave = debounce(async () => {
  await onSave(updatedTask);
}, autoSaveDelay);
```

### Testing

```typescript
describe('Split-View Integration', () => {
  it('should mount successfully', () => {
    const view = new RecurringDashboardView(container, props);
    view.mount();
    expect(container.querySelector('.dashboard-split-view')).toBeTruthy();
  });

  it('should respect feature flag', () => {
    const settings = { splitViewDashboard: { useSplitViewDashboard: false } };
    settingsService.get.mockReturnValue(settings);
    
    const view = new RecurringDashboardView(container, props);
    view.mount();
    
    // Should use legacy dashboard
    expect(container.querySelector('.recurring-dashboard-container')).toBeTruthy();
  });
});
```

### Deprecation Timeline

- **v1.0**: Split-view available as beta (feature flag, default ON for new installs)
- **v1.1**: Split-view becomes default for all users
- **v1.2**: Legacy dashboard deprecated but still accessible via settings
- **v2.0**: Legacy dashboard removed

### Migration Checklist

- [ ] Update settings to include `splitViewDashboard` configuration
- [ ] Implement feature flag check in dashboard mounting logic
- [ ] Add settings UI for toggling split-view
- [ ] Test with both split-view enabled and disabled
- [ ] Update documentation for users
- [ ] Monitor error logs for any split-view specific issues

### Common Pitfalls

1. **Forgetting to handle auto-save**: The split-view relies on auto-save. Make sure your save handlers are robust.

2. **Not clearing selection on unmount**: Always clean up selectedTaskStore when unmounting.

3. **Hardcoding settings**: Always read from settingsService, don't hardcode default values.

4. **Ignoring mobile layout**: Test on different screen sizes. The split-view adapts automatically but test your custom styles.

### Performance Considerations

- The split-view uses virtual scrolling for large task lists (>100 tasks)
- Auto-save is debounced to prevent excessive API calls
- Component state is managed efficiently with Svelte 5's runes

### Backward Compatibility

The integration maintains full backward compatibility:
- Existing users see no change until they opt-in
- Settings migration handles missing fields gracefully
- Legacy dashboard code path remains intact
- No database schema changes required

### Support

For questions or issues:
- Check the user guide: `docs/split-view-dashboard.md`
- Review the implementation: `src/dashboard/RecurringDashboardView.ts`
- Open an issue on GitHub
