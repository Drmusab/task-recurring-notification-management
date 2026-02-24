/**
 * Dashboard Components Module
 * 
 * Exports all dashboard-related components for the SiYuan Task Management Plugin.
 * All components are WCAG 2.1 Level AA compliant.
 * 
 * TaskDashboardDock is the primary dock-mounted component (replaces Dashboard).
 * Dashboard is kept for backwards compatibility.
 * 
 * @module @components/dashboard
 */

export { default as TaskDashboardDock } from './TaskDashboardDock.svelte';
export { default as TaskSummary } from './TaskSummary.svelte';
export { default as QuickActions } from './QuickActions.svelte';
export { default as UpcomingTasks } from './UpcomingTasks.svelte';
export { default as TaskStats } from './TaskStats.svelte';
export { default as Dashboard } from './Dashboard.svelte';
export { default as DockPanel } from './DockPanel.svelte';

