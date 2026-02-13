/**
 * DashboardLayoutManager - Manages dashboard layouts, presets, and persistence
 * Phase 4.3: Custom Dashboards
 */

import type { 
  Widget, 
  DashboardLayout, 
  LayoutPreset, 
  DashboardSettings,
  DashboardExport,
  WidgetType
} from './WidgetTypes';

const STORAGE_KEY = 'siyuan-task-dashboard-layout';
const SETTINGS_KEY = 'siyuan-task-dashboard-settings';
const VERSION = '1.0.0';

export class DashboardLayoutManager {
  private currentLayout: DashboardLayout | null = null;
  private settings: DashboardSettings;
  private listeners: Set<(layout: DashboardLayout) => void> = new Set();
  
  constructor() {
    this.settings = this.loadSettings();
    this.currentLayout = this.loadLayout() || this.getDefaultLayout();
  }
  
  /**
   * Subscribe to layout changes
   */
  subscribe(listener: (layout: DashboardLayout) => void): () => void {
    this.listeners.add(listener);
    listener(this.getCurrentLayout()); // Emit current state
    return () => this.listeners.delete(listener);
  }
  
  /**
   * Notify all listeners of layout change
   */
  private notifyListeners(): void {
    if (this.currentLayout) {
      this.listeners.forEach(listener => listener({ ...this.currentLayout! }));
    }
  }
  
  /**
   * Get current layout
   */
  getCurrentLayout(): DashboardLayout {
    return this.currentLayout || this.getDefaultLayout();
  }
  
  /**
   * Get default layout with all widgets
   */
  getDefaultLayout(): DashboardLayout {
    return {
      id: 'default',
      name: 'Default Dashboard',
      description: 'Standard analytics dashboard with all widgets',
      isDefault: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      widgets: [
        // Stats Cards (order 0-5)
        {
          id: 'stats-completion-rate',
          type: 'stats-card',
          title: 'Completion Rate',
          size: 'small',
          order: 0,
          visible: true,
          config: { statsCard: { metric: 'completion-rate' } }
        },
        {
          id: 'stats-miss-rate',
          type: 'stats-card',
          title: 'Miss Rate',
          size: 'small',
          order: 1,
          visible: true,
          config: { statsCard: { metric: 'miss-rate' } }
        },
        {
          id: 'stats-current-streak',
          type: 'stats-card',
          title: 'Current Streak',
          size: 'small',
          order: 2,
          visible: true,
          config: { statsCard: { metric: 'current-streak' } }
        },
        {
          id: 'stats-health',
          type: 'stats-card',
          title: 'Average Health',
          size: 'small',
          order: 3,
          visible: true,
          config: { statsCard: { metric: 'health' } }
        },
        {
          id: 'stats-active-tasks',
          type: 'stats-card',
          title: 'Active Tasks',
          size: 'small',
          order: 4,
          visible: true,
          config: { statsCard: { metric: 'active-tasks' } }
        },
        {
          id: 'stats-overdue',
          type: 'stats-card',
          title: 'Overdue',
          size: 'small',
          order: 5,
          visible: true,
          config: { statsCard: { metric: 'overdue' } }
        },
        
        // Charts (order 6-7)
        {
          id: 'completion-chart',
          type: 'completion-chart',
          title: 'Completion Trend',
          description: '30-day completion trend',
          size: 'large',
          order: 6,
          visible: true,
          config: { chart: { days: 30, showTrend: true, showAverage: true } }
        },
        {
          id: 'habit-tracker',
          type: 'habit-tracker',
          title: 'Habit Heatmap',
          description: '26-week habit heatmap',
          size: 'full-width',
          order: 7,
          visible: true,
          config: { habitTracker: { weeks: 26, showWeekends: true } }
        },
        
        // Phase 4.1 Predictive Analytics (order 8-10)
        {
          id: 'predictive-insights',
          type: 'predictive-insights',
          title: 'Predictive Insights',
          description: 'ML-powered completion predictions',
          size: 'full-width',
          order: 8,
          visible: true
        },
        {
          id: 'week-comparison',
          type: 'week-comparison',
          title: 'Week-over-Week',
          description: 'Weekly performance comparison',
          size: 'large',
          order: 9,
          visible: true
        },
        {
          id: 'health-breakdown',
          type: 'health-breakdown',
          title: 'Health Breakdown',
          description: 'Task health distribution',
          size: 'large',
          order: 10,
          visible: true
        },
        
        // Summary (order 11)
        {
          id: 'summary',
          type: 'summary',
          title: 'Summary Stats',
          size: 'medium',
          order: 11,
          visible: true
        }
      ]
    };
  }
  
  /**
   * Get predefined layout presets
   */
  getPresets(): LayoutPreset[] {
    return [
      {
        id: 'default',
        name: 'Default',
        description: 'All widgets with standard layout',
        icon: '📊',
        layout: this.getDefaultLayout()
      },
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Essential metrics only',
        icon: '📉',
        layout: this.getMinimalLayout()
      },
      {
        id: 'detailed',
        name: 'Detailed',
        description: 'In-depth analytics focus',
        icon: '📈',
        layout: this.getDetailedLayout()
      },
      {
        id: 'predictive',
        name: 'Predictive',
        description: 'ML predictions and forecasts',
        icon: '🔮',
        layout: this.getPredictiveLayout()
      }
    ];
  }
  
  /**
   * Get minimal layout (stats cards + completion chart only)
   */
  private getMinimalLayout(): DashboardLayout {
    const defaultLayout = this.getDefaultLayout();
    return {
      ...defaultLayout,
      id: 'minimal',
      name: 'Minimal Dashboard',
      description: 'Essential metrics and trend chart',
      widgets: defaultLayout.widgets.map(w => ({
        ...w,
        visible: ['stats-card', 'completion-chart'].includes(w.type)
      }))
    };
  }
  
  /**
   * Get detailed layout (all charts, hide summary)
   */
  private getDetailedLayout(): DashboardLayout {
    const defaultLayout = this.getDefaultLayout();
    return {
      ...defaultLayout,
      id: 'detailed',
      name: 'Detailed Analytics',
      description: 'Comprehensive analytics view',
      widgets: defaultLayout.widgets.map(w => ({
        ...w,
        visible: w.type !== 'summary'
      }))
    };
  }
  
  /**
   * Get predictive layout (ML-focused)
   */
  private getPredictiveLayout(): DashboardLayout {
    const defaultLayout = this.getDefaultLayout();
    return {
      ...defaultLayout,
      id: 'predictive',
      name: 'Predictive Dashboard',
      description: 'ML predictions and behavioral insights',
      widgets: defaultLayout.widgets.map(w => ({
        ...w,
        visible: ['stats-card', 'predictive-insights', 'week-comparison', 'health-breakdown'].includes(w.type)
      }))
    };
  }
  
  /**
   * Update widget visibility
   */
  toggleWidgetVisibility(widgetId: string): void {
    if (!this.currentLayout) return;
    
    this.currentLayout.widgets = this.currentLayout.widgets.map(w =>
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    );
    
    this.currentLayout.updatedAt = new Date().toISOString();
    
    if (this.settings.autoSave) {
      this.saveLayout();
    }
    
    this.notifyListeners();
  }
  
  /**
   * Update widget size
   */
  updateWidgetSize(widgetId: string, size: Widget['size']): void {
    if (!this.currentLayout) return;
    
    this.currentLayout.widgets = this.currentLayout.widgets.map(w =>
      w.id === widgetId ? { ...w, size } : w
    );
    
    this.currentLayout.updatedAt = new Date().toISOString();
    
    if (this.settings.autoSave) {
      this.saveLayout();
    }
    
    this.notifyListeners();
  }
  
  /**
   * Update widget order after drag-drop
   */
  updateWidgetOrder(widgets: Widget[]): void {
    if (!this.currentLayout) return;
    
    this.currentLayout.widgets = widgets;
    this.currentLayout.updatedAt = new Date().toISOString();
    
    if (this.settings.autoSave) {
      this.saveLayout();
    }
    
    this.notifyListeners();
  }
  
  /**
   * Add custom widget
   */
  addWidget(widget: Omit<Widget, 'id' | 'order'>): void {
    if (!this.currentLayout) return;
    
    const newWidget: Widget = {
      ...widget,
      id: `custom-${Date.now()}`,
      order: this.currentLayout.widgets.length
    };
    
    this.currentLayout.widgets.push(newWidget);
    this.currentLayout.updatedAt = new Date().toISOString();
    
    if (this.settings.autoSave) {
      this.saveLayout();
    }
    
    this.notifyListeners();
  }
  
  /**
   * Remove widget
   */
  removeWidget(widgetId: string): void {
    if (!this.currentLayout) return;
    
    this.currentLayout.widgets = this.currentLayout.widgets
      .filter(w => w.id !== widgetId)
      .map((w, index) => ({ ...w, order: index }));
    
    this.currentLayout.updatedAt = new Date().toISOString();
    
    if (this.settings.autoSave) {
      this.saveLayout();
    }
    
    this.notifyListeners();
  }
  
  /**
   * Load preset layout
   */
  loadPreset(presetId: string): void {
    const preset = this.getPresets().find(p => p.id === presetId);
    if (preset) {
      this.currentLayout = {
        ...preset.layout,
        updatedAt: new Date().toISOString()
      };
      
      this.saveLayout();
      this.notifyListeners();
    }
  }
  
  /**
   * Reset to default layout
   */
  resetToDefault(): void {
    this.currentLayout = this.getDefaultLayout();
    this.saveLayout();
    this.notifyListeners();
  }
  
  /**
   * Save current layout to localStorage
   */
  saveLayout(): void {
    if (!this.currentLayout) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentLayout));
    } catch (error) {
      console.error('Failed to save dashboard layout:', error);
    }
  }
  
  /**
   * Load layout from localStorage
   */
  private loadLayout(): DashboardLayout | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load dashboard layout:', error);
    }
    return null;
  }
  
  /**
   * Get current settings
   */
  getSettings(): DashboardSettings {
    return { ...this.settings };
  }
  
  /**
   * Update settings
   */
  updateSettings(updates: Partial<DashboardSettings>): void {
    this.settings = {
      ...this.settings,
      ...updates
    };
    
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Failed to save dashboard settings:', error);
    }
  }
  
  /**
   * Load settings from localStorage
   */
  private loadSettings(): DashboardSettings {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load dashboard settings:', error);
    }
    
    // Default settings
    return {
      layout: this.getDefaultLayout(),
      editMode: false,
      autoSave: true,
      showWidgetBorders: true,
      compactMode: false,
      theme: 'default'
    };
  }
  
  /**
   * Export layout configuration
   */
  exportLayout(): DashboardExport {
    const layout = this.getCurrentLayout();
    return {
      version: VERSION,
      exportedAt: new Date().toISOString(),
      layout,
      metadata: {
        widgetCount: layout.widgets.length,
        customMetrics: layout.widgets.filter(w => w.type === 'custom-metric').length
      }
    };
  }
  
  /**
   * Import layout configuration
   */
  importLayout(exportData: DashboardExport): boolean {
    try {
      // Validate version compatibility
      if (exportData.version !== VERSION) {
        console.warn('Layout version mismatch. Attempting import anyway.');
      }
      
      this.currentLayout = {
        ...exportData.layout,
        updatedAt: new Date().toISOString()
      };
      
      this.saveLayout();
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Failed to import layout:', error);
      return false;
    }
  }
}

/**
 * Singleton instance
 */
export const dashboardLayoutManager = new DashboardLayoutManager();
