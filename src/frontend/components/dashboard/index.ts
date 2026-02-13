/**
 * Dashboard Components Module
 * 
 * Exports all dashboard-related components for the SiYuan Task Management Plugin.
 * All components are WCAG 2.1 Level AA compliant.
 * 
 * @module @components/dashboard
 */

export { default as TaskSummary } from './TaskSummary.svelte';
export { default as QuickActions } from './QuickActions.svelte';
export { default as UpcomingTasks } from './UpcomingTasks.svelte';
export { default as TaskStats } from './TaskStats.svelte';
export { default as RecentActivity } from './RecentActivity.svelte';

// Type exports for component props
export type {
  TaskSummaryProps,
  QuickActionsProps,
  UpcomingTasksProps,
  TaskStatsProps,
  RecentActivityProps
} from './types';
