/**
 * Shared Components Index
 * 
 * Exports all reusable UI components
 * 
 * @module shared
 */

// Accessibility-compliant utility components
export { default as Icon } from "./Icon.svelte";
export { default as Button } from "./Button.svelte";
export { default as Tooltip } from "./Tooltip.svelte";
export { default as Dropdown } from "./Dropdown.svelte";
export { default as ContextMenu } from "./ContextMenu.svelte";

// Other shared components
export { default as LoadingSpinner } from "./LoadingSpinner.svelte";
export { default as ErrorMessage } from "./ErrorMessage.svelte";
export { default as KeyboardShortcutsHelp } from "./KeyboardShortcutsHelp.svelte";
export { default as TimelineView } from "./TimelineView.svelte";
export { default as TaskTemplateManager } from "./TaskTemplateManager.svelte";
export { default as TaskListItem } from "./TaskListItem.svelte";
export { default as TaskListView } from "./TaskListView.svelte";
export { default as TrackerDashboard } from "./TrackerDashboard.svelte";
export { default as UrgencyIndicator } from "../../ui/components/shared/UrgencyIndicator.svelte";
export { default as DependencyGraphView } from "../../ui/components/shared/DependencyGraphView.svelte";
