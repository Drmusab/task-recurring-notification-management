# Split-View Dashboard User Guide

## Overview

The split-view dashboard provides a faster, more intuitive way to manage your tasks without constant modal dialogs and tab switching.

## Features

### Task List (Left Pane)
- **Filters**: All / Today / Upcoming / Recurring / Overdue
- **Task Counts**: See how many tasks in each category
- **Keyboard Navigation**: Use ↑↓ to navigate, Enter to select
- **New Task**: Click "+ New Task" to create

### Editor (Right Pane)
- **Inline Editing**: Edit tasks directly without opening a modal
- **Auto-Save**: Changes save automatically after 500ms (configurable)
- **Visual Feedback**: See unsaved changes indicator
- **All Fields**: Same powerful editing capabilities as modal view

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ↑ / ↓ | Navigate task list |
| Enter | Select task for editing |
| Esc | Clear selection |
| Ctrl+N | Create new task |

## Settings

### Enable Split-View
1. Open Settings (⚙️ icon)
2. Navigate to "Dashboard" section
3. Check "Use Split-View Dashboard (Beta)"
4. Click "Save Dashboard Settings"
5. Reload the dashboard

### Auto-Save Delay
- **Default**: 500ms
- **Adjust**: In Settings > Dashboard > Auto-save delay
- **Range**: 100ms - 2000ms
- Lower values = more responsive, more frequent saves
- Higher values = less frequent saves, better for slower systems

### Split Ratio
- **Default**: 0.4 (40% list, 60% editor)
- **Adjust**: In Settings > Dashboard > Split ratio
- **Range**: 0.2 - 0.6
- Customize the layout to your preference

## FAQ

**Q: Can I switch back to the old dashboard?**  
A: Yes! Uncheck "Use Split-View Dashboard" in Settings > Dashboard.

**Q: Will my edits be saved if I close the dashboard?**  
A: Auto-save triggers after you stop typing (default 500ms). Wait for the save indicator to confirm changes are saved.

**Q: Does it work on mobile?**  
A: Yes! The layout automatically stacks vertically on smaller screens for better usability.

**Q: What if I have 1000+ tasks?**  
A: The dashboard uses virtual scrolling for large lists - performance remains smooth.

**Q: Why is split-view in beta?**  
A: We're gathering feedback to refine the experience. The core functionality is stable, but we may add improvements based on user feedback.

## Tips & Tricks

1. **Quick Navigation**: Use arrow keys to browse tasks quickly without clicking
2. **Batch Editing**: Select a task, make changes, press ↓ to move to next task - changes auto-save
3. **Filter First**: Use filters to narrow down your task list before editing
4. **Adjust Timing**: If auto-save feels too fast or slow, adjust the delay in settings

## Troubleshooting

**Problem**: Dashboard won't load  
**Solution**: Try disabling split-view in Settings and reloading. Check browser console for errors.

**Problem**: Auto-save isn't working  
**Solution**: Verify auto-save delay is set to a reasonable value (500ms recommended). Check for JavaScript errors.

**Problem**: Layout looks broken  
**Solution**: Try adjusting the split ratio in settings. Clear browser cache and reload.

## Feedback

We'd love to hear your thoughts on the split-view dashboard! Please report issues or suggestions through the plugin's issue tracker.
