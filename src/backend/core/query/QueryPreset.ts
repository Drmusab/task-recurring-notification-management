/**
 * Query Preset model for saving and sharing query configurations
 */

export interface QueryPreset {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** Query string */
  query: string;
  
  /** Optional icon (emoji or icon name) */
  icon?: string;
  
  /** Optional color for visual distinction */
  color?: string;
  
  /** Creation timestamp (ISO string) */
  createdAt: string;
  
  /** Last update timestamp (ISO string) */
  updatedAt: string;
  
  /** Whether this is a built-in preset */
  isBuiltIn: boolean;
}

/**
 * Built-in presets that come with the plugin
 */
export const BUILT_IN_PRESETS: QueryPreset[] = [
  {
    id: 'today-focus',
    name: "Today's Focus",
    description: "Top 10 urgent tasks due today",
    query: `filter status is todo
filter due today
sort urgency
limit 10`,
    icon: '🎯',
    color: '#FF6B6B',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'this-week',
    name: 'This Week',
    description: 'All tasks due this week, grouped by priority',
    query: `filter status is todo
filter due after today
filter due before 7 days
group by priority
sort due`,
    icon: '📅',
    color: '#4ECDC4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'overdue',
    name: 'Overdue',
    description: 'Tasks past their due date, sorted by urgency',
    query: `filter status is todo
filter due before today
sort urgency
show urgency`,
    icon: '⚠️',
    color: '#FFE66D',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'waiting-on-others',
    name: 'Waiting on Others',
    description: 'Tasks blocked by dependencies',
    query: `filter status is todo
filter has dependencies
filter is blocked
group by dependency`,
    icon: '⏳',
    color: '#95E1D3',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'high-priority',
    name: 'High Priority',
    description: 'All high and highest priority tasks',
    query: `filter status is todo
filter priority >= high
sort urgency`,
    icon: '🔴',
    color: '#FF6B9D',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'upcoming',
    name: 'Upcoming',
    description: 'Tasks scheduled for the next 30 days',
    query: `filter status is todo
filter due after today
filter due before 30 days
sort due`,
    icon: '📆',
    color: '#A8E6CF',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  },
  {
    id: 'no-due-date',
    name: 'No Due Date',
    description: 'Tasks without a due date',
    query: `filter status is todo
filter not has due
sort priority`,
    icon: '📝',
    color: '#FFDAC1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isBuiltIn: true
  }
];

/**
 * Create a new query preset
 */
export function createQueryPreset(
  name: string,
  query: string,
  options: Partial<Omit<QueryPreset, 'id' | 'name' | 'query' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>> = {}
): QueryPreset {
  const now = new Date().toISOString();
  return {
    id: generatePresetId(name),
    name,
    query,
    description: options.description,
    icon: options.icon,
    color: options.color,
    createdAt: now,
    updatedAt: now,
    isBuiltIn: false
  };
}

/**
 * Generate a unique preset ID from name
 */
function generatePresetId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const timestamp = Date.now().toString(36);
  return `${slug}-${timestamp}`;
}

/**
 * Validate a query preset
 */
export function isValidQueryPreset(preset: QueryPreset): boolean {
  return !!(
    preset.id &&
    preset.name &&
    preset.query &&
    preset.createdAt &&
    preset.updatedAt
  );
}

/**
 * Export preset to shareable format (base64 encoded JSON)
 */
export function exportPreset(preset: QueryPreset): string {
  const exportData = {
    name: preset.name,
    description: preset.description,
    query: preset.query,
    icon: preset.icon,
    color: preset.color
  };
  // Use Buffer for proper Unicode support
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(JSON.stringify(exportData), 'utf-8').toString('base64');
  }
  // Fallback to btoa for browser environments
  return btoa(unescape(encodeURIComponent(JSON.stringify(exportData))));
}

/**
 * Import preset from shareable format
 */
export function importPreset(encoded: string): QueryPreset | null {
  try {
    let jsonString: string;
    // Use Buffer for proper Unicode support
    if (typeof Buffer !== 'undefined') {
      jsonString = Buffer.from(encoded, 'base64').toString('utf-8');
    } else {
      // Fallback to atob for browser environments
      jsonString = decodeURIComponent(escape(atob(encoded)));
    }
    
    const decoded = JSON.parse(jsonString);
    if (!decoded.name || !decoded.query) {
      return null;
    }
    return createQueryPreset(decoded.name, decoded.query, {
      description: decoded.description,
      icon: decoded.icon,
      color: decoded.color
    });
  } catch (error) {
    return null;
  }
}

/**
 * Export multiple presets to JSON
 */
export function exportPresetsToJSON(presets: QueryPreset[]): string {
  return JSON.stringify(presets, null, 2);
}

/**
 * Import multiple presets from JSON
 */
export function importPresetsFromJSON(json: string): QueryPreset[] {
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) {
      return [];
    }
    return data
      .map(item => {
        if (!item.name || !item.query) {
          return null;
        }
        return createQueryPreset(item.name, item.query, {
          description: item.description,
          icon: item.icon,
          color: item.color
        });
      })
      .filter((preset): preset is QueryPreset => preset !== null);
  } catch (error) {
    return [];
  }
}
