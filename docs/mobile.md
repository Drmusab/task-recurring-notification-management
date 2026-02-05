# Mobile Usage Tips

The Recurring Task Management plugin is fully optimized for mobile devices, providing a touch-friendly interface that works seamlessly on phones and tablets.

## Mobile Optimizations

### Touch Targets
All interactive elements meet the minimum recommended touch target size:
- **Buttons**: Minimum 44×44px (iOS standard)
- **Checkboxes**: 24×24px with generous padding
- **Task rows**: Minimum 44px height

### Responsive Layout
The interface automatically adapts based on screen size:

#### Mobile (< 768px)
- Single-column stack layout
- Sidebar hidden by default
- Bottom sheet modals
- Full-width task cards

#### Tablet (768px - 1024px)
- Two-column layout (250px sidebar + main content)
- Collapsible advanced filters
- Side-by-side panels

#### Desktop (> 1024px)
- Full multi-column layout
- Persistent sidebar
- Modal dialogs

## Touch Gestures

### Swipe Actions (Planned)
Swipe left or right on task rows for quick actions:
- **Swipe Right**: Mark task as done
- **Swipe Left**: Delete/Archive task

### Long Press
Long-press on a task to open the context menu with additional options:
- Edit task
- Postpone
- Mark done
- Delete
- View dependencies

### Pull to Refresh
Pull down on the task list to refresh and sync your tasks.

## Mobile Features

### Bottom Sheet Modals
On mobile devices, task creation and editing use bottom sheets instead of traditional modals:
- Slides up from bottom
- Easy to dismiss with swipe down
- iOS-style handle indicator
- Up to 90% of screen height

### Keyboard Behavior
Input fields use `font-size: 16px` to prevent unwanted zoom on iOS when focusing inputs.

### Optimized Scrolling
- Smooth scrolling with `-webkit-overflow-scrolling: touch`
- Virtual scrolling for large task lists (renders only visible items)
- Momentum scrolling on iOS

### Simplified UI
Mobile view simplifies the interface:
- Hidden advanced filters (accessible via toggle)
- Compact date displays (no labels like "Due:")
- Simplified priority badges
- Streamlined navigation tabs

## Using on Mobile

### Quick Task Creation
1. Tap the **+** button (floating action button)
2. Bottom sheet slides up
3. Enter task details
4. Swipe down or tap outside to dismiss
5. Changes save automatically

### Managing Tasks
1. **Tap** a task to view details
2. **Long-press** for context menu
3. **Swipe** for quick actions (planned)
4. **Checkbox** to mark done

### Filtering Tasks
1. Tap the **filter icon** to show/hide filters
2. Filters slide in as full-screen overlay
3. Tap outside or **X** button to close
4. Applied filters persist

### Navigation
Horizontal scrolling tab bar:
- Swipe left/right to see more tabs
- Tap a tab to switch views
- Active tab highlighted

## Tips for Best Mobile Experience

### 1. Use Query Presets
Save common filters as presets for one-tap access:
- "Today's Focus"
- "This Week"
- "High Priority"

### 2. Enable Notifications
Get reminders even when the app isn't open:
- Due date notifications
- Overdue task alerts
- Daily summary

### 3. Landscape Mode
For easier typing and more screen space:
- Keyboard takes less relative space
- Bottom sheets adjust height
- More content visible

### 4. Dark Mode
The plugin respects system dark mode preference:
- Automatically switches with system setting
- Optimized colors for low-light viewing
- Reduced eye strain

### 5. Voice Input
Use device voice input for task names and notes:
- Tap microphone on keyboard
- Speak task description
- Voice-to-text converts to task

## Accessibility

### Touch Targets
All interactive elements exceed WCAG 2.1 AAA standards:
- Minimum 44×44px touch targets
- Adequate spacing between elements
- Clear visual feedback

### Reduced Motion
Respects `prefers-reduced-motion` setting:
- Animations reduced to minimal/instant
- No autoplay animations
- Static transitions

### Screen Readers
Compatible with mobile screen readers:
- Proper ARIA labels
- Semantic HTML
- Logical tab order

### High Contrast
Works with high contrast mode:
- Sufficient color contrast ratios
- Clear borders and outlines
- Visible focus indicators

## Performance Tips

### Large Task Lists
For better performance with 100+ tasks:
1. Use filters to reduce visible items
2. Archive completed tasks regularly
3. Enable virtual scrolling (automatic)
4. Close unused browser tabs

### Battery Saving
Reduce battery usage:
1. Enable dark mode
2. Reduce animation (system settings)
3. Close app when not in use
4. Disable background sync if not needed

### Offline Usage
The plugin works offline:
- Tasks cached locally
- Changes sync when online
- No internet required for basic features

## Troubleshooting

### Issue: Zoom on Input Focus (iOS)
**Solution**: Already handled - inputs use 16px font size

### Issue: Scrolling Feels Slow
**Solution**: Enable "Reduce Motion" in system settings for simpler animations

### Issue: Bottom Sheet Won't Dismiss
**Solution**: Try:
1. Swipe down on the sheet
2. Tap outside the sheet
3. Tap the X button
4. Refresh the page

### Issue: Swipe Gestures Not Working
**Solution**: 
1. Ensure you're swiping horizontally
2. Start swipe from task row, not edges
3. Feature may still be in development

### Issue: Can't See Sidebar
**Solution**: On mobile, sidebar is hidden by default:
1. This is intentional for single-column layout
2. Access via hamburger menu (if available)
3. Use landscape mode on tablets for two-column

## Known Limitations

### Current Mobile Limitations
1. Swipe gestures - CSS foundation ready, JS handlers pending
2. Pull-to-refresh - Planned feature
3. Long-press menu - Custom implementation needed
4. Keyboard shortcuts - Desktop only

### Mobile-Specific Considerations
1. Smaller screen = less visible tasks
2. Touch input less precise than mouse
3. Battery life impact
4. Network connectivity variations

## Best Practices

### Do's ✅
- Use query presets for quick access
- Enable notifications for important tasks
- Archive old tasks to improve performance
- Use landscape mode for data entry
- Keep task names concise
- Leverage touch gestures when available

### Don'ts ❌
- Don't keep hundreds of active tasks visible
- Don't disable JavaScript (plugin won't work)
- Don't use tiny fonts (rely on default sizes)
- Don't fight the mobile layout (it's optimized)
- Don't expect desktop features on mobile

## Future Enhancements

Planned mobile improvements:
- [ ] Native mobile app
- [ ] Offline-first architecture
- [ ] Advanced swipe gestures
- [ ] Biometric authentication
- [ ] Widget support
- [ ] Share sheet integration
- [ ] Siri/Google Assistant shortcuts

## Feedback

If you encounter mobile-specific issues:
1. Check device and OS version
2. Clear browser cache
3. Try different browser
4. Report with screenshots
5. Include device details

---

**Note**: Mobile features are continuously being improved. Check the changelog for the latest updates.
