/**
 * Widget Types - Type definitions for customizable dashboard widgets
 * Phase 4.3: Custom Dashboards
 */

export type WidgetSize = 'small' | 'medium' | 'large' | 'full-width';
export type WidgetType = 
  | 'stats-card'
  | 'completion-chart'
  | 'habit-tracker'
  | 'predictive-insights'
  | 'week-comparison'
  | 'health-breakdown'
  | 'summary'
  | 'custom-metric';

/**
 * Widget metadata and configuration
 */
export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  size: WidgetSize;
  order: number;
  visible: boolean;
  config?: WidgetConfig;
}

/**
 * Widget-specific configuration
 */
export interface WidgetConfig {
  // Stats Card Config
  statsCard?: {
    metric: 'completion-rate' | 'miss-rate' | 'current-streak' | 'health' | 'active-tasks' | 'overdue';
  };
  
  // Chart Config
  chart?: {
    days?: number;
    showTrend?: boolean;
    showAverage?: boolean;
  };
  
  // Habit Tracker Config
  habitTracker?: {
    weeks?: number;
    showWeekends?: boolean;
  };
  
  // Custom Metric Config
  customMetric?: {
    name: string;
    calculation: MetricCalculation;
    filters?: MetricFilters;
  };
}

/**
 * Custom metric calculation definition
 */
export interface MetricCalculation {
  aggregation: 'count' | 'sum' | 'average' | 'min' | 'max' | 'percentage';
  field: 'completions' | 'misses' | 'streak' | 'health' | 'delay' | 'duration';
  formula?: string; // For composite metrics (e.g., "(completions / total) * 100")
}

/**
 * Filters for custom metrics
 */
export interface MetricFilters {
  tags?: string[];
  categories?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  priority?: ('low' | 'medium' | 'high')[];
  status?: ('active' | 'disabled' | 'completed')[];
}

/**
 * Dashboard layout configuration
 */
export interface DashboardLayout {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
  widgets: Widget[];
}

/**
 * Layout preset template
 */
export interface LayoutPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  layout: DashboardLayout;
}

/**
 * Drag-and-drop state
 */
export interface DragDropState {
  isDragging: boolean;
  draggedWidgetId: string | null;
  draggedOverWidgetId: string | null;
  dropEffect: 'move' | 'copy' | 'none';
}

/**
 * Widget registry entry
 */
export interface WidgetRegistryEntry {
  type: WidgetType;
  title: string;
  description: string;
  icon: string;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  component: any; // Svelte component
  configurable: boolean;
}

/**
 * Dashboard customization settings
 */
export interface DashboardSettings {
  layout: DashboardLayout;
  editMode: boolean;
  autoSave: boolean;
  showWidgetBorders: boolean;
  compactMode: boolean;
  theme: 'default' | 'minimal' | 'detailed';
}

/**
 * Export format for dashboard configurations
 */
export interface DashboardExport {
  version: string;
  exportedAt: string;
  layout: DashboardLayout;
  metadata?: {
    taskCount?: number;
    widgetCount?: number;
    customMetrics?: number;
  };
}
