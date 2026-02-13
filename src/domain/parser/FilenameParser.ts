/**
 * FilenameParser - Extract dates from daily note filenames
 * Phase 4: Dependencies + Advanced Query
 */

/**
 * Date pattern configuration
 */
export interface DatePattern {
  /** Pattern name for debugging */
  name: string;
  
  /** Regex pattern to match */
  pattern: RegExp;
  
  /** Extractor function to convert match to ISO date */
  extract: (match: RegExpMatchArray) => string | null;
}

/**
 * Built-in date patterns
 */
export const DEFAULT_DATE_PATTERNS: DatePattern[] = [
  // YYYY-MM-DD (ISO format)
  {
    name: 'ISO Date',
    pattern: /(\d{4})-(\d{2})-(\d{2})/,
    extract: (match) => {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    },
  },
  
  // YYYYMMDD (compact format)
  {
    name: 'Compact Date',
    pattern: /(\d{4})(\d{2})(\d{2})/,
    extract: (match) => {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    },
  },
  
  // DD-MM-YYYY (European format)
  {
    name: 'European Date',
    pattern: /(\d{2})-(\d{2})-(\d{4})/,
    extract: (match) => {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    },
  },
  
  // MM-DD-YYYY (US format)
  {
    name: 'US Date',
    pattern: /(\d{2})\/(\d{2})\/(\d{4})/,
    extract: (match) => {
      const [, month, day, year] = match;
      return `${year}-${month}-${day}`;
    },
  },
  
  // YYYY.MM.DD (dotted format)
  {
    name: 'Dotted Date',
    pattern: /(\d{4})\.(\d{2})\.(\d{2})/,
    extract: (match) => {
      const [, year, month, day] = match;
      return `${year}-${month}-${day}`;
    },
  },
  
  // Month name formats (e.g., "2026-Feb-06", "Feb 6, 2026")
  {
    name: 'Month Name',
    pattern: /(\d{4})[- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[- ](\d{1,2})/i,
    extract: (match) => {
      const [, year, monthName, day] = match;
      if (!year || !monthName || !day) return null;
      
      const monthMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04',
        may: '05', jun: '06', jul: '07', aug: '08',
        sep: '09', oct: '10', nov: '11', dec: '12',
      };
      const month = monthMap[monthName.toLowerCase()];
      if (!month) return null;
      
      return `${year}-${month}-${day.padStart(2, '0')}`;
    },
  },
];

/**
 * Filename parsing configuration
 */
export interface FilenameParserConfig {
  /** Custom date patterns to use (in addition to defaults) */
  customPatterns?: DatePattern[];
  
  /** Use default patterns? */
  useDefaults: boolean;
  
  /** Prefer which pattern if multiple match? (by name or index) */
  preferredPattern?: string;
}

/**
 * FilenameParser extracts dates from filenames
 */
export class FilenameParser {
  private patterns: DatePattern[];
  private config: FilenameParserConfig;
  
  constructor(config: FilenameParserConfig = { useDefaults: true }) {
    this.config = config;
    this.patterns = [];
    
    if (config.useDefaults) {
      this.patterns.push(...DEFAULT_DATE_PATTERNS);
    }
    
    if (config.customPatterns) {
      this.patterns.push(...config.customPatterns);
    }
  }
  
  /**
   * Extract date from filename
   * Returns ISO date string (YYYY-MM-DD) or null if no match
   */
  extractDate(filename: string): string | null {
    // Remove file extension
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    // Try each pattern
    for (const pattern of this.patterns) {
      const match = nameWithoutExt.match(pattern.pattern);
      if (match) {
        try {
          const date = pattern.extract(match);
          if (date && this.isValidDate(date)) {
            return date;
          }
        } catch (error) {
          // Pattern failed, try next
          continue;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Extract all dates from filename (if multiple patterns match)
   */
  extractAllDates(filename: string): string[] {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    const dates: string[] = [];
    
    for (const pattern of this.patterns) {
      const match = nameWithoutExt.match(pattern.pattern);
      if (match) {
        try {
          const date = pattern.extract(match);
          if (date && this.isValidDate(date)) {
            dates.push(date);
          }
        } catch (error) {
          // Skip invalid dates
        }
      }
    }
    
    return dates;
  }
  
  /**
   * Validate ISO date string
   */
  private isValidDate(dateString: string): boolean {
    // Check format: YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return false;
    }
    
    const parts = dateString.split('-').map(Number);
    if (parts.length !== 3) return false;
    
    const year = parts[0]!;
    const month = parts[1]!;
    const day = parts[2]!;
    
    // Check ranges
    if (year < 1900 || year > 2100) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    // Check actual date validity
    const date = new Date(dateString);
    return !isNaN(date.getTime()) &&
           date.getFullYear() === year &&
           date.getMonth() + 1 === month &&
           date.getDate() === day;
  }
  
  /**
   * Check if filename contains a date
   */
  hasDate(filename: string): boolean {
    return this.extractDate(filename) !== null;
  }
  
  /**
   * Get pattern that matched (for debugging)
   */
  getMatchingPattern(filename: string): DatePattern | null {
    const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
    
    for (const pattern of this.patterns) {
      if (nameWithoutExt.match(pattern.pattern)) {
        return pattern;
      }
    }
    
    return null;
  }
  
  /**
   * Add a custom pattern
   */
  addPattern(pattern: DatePattern): void {
    this.patterns.push(pattern);
  }
  
  /**
   * Remove a pattern by name
   */
  removePattern(name: string): void {
    this.patterns = this.patterns.filter(p => p.name !== name);
  }
  
  /**
   * Get all configured patterns
   */
  getPatterns(): DatePattern[] {
    return [...this.patterns];
  }
}

/**
 * Parse date from various filename formats
 * Convenience function using default patterns
 */
export function parseDateFromFilename(filename: string): string | null {
  const parser = new FilenameParser();
  return parser.extractDate(filename);
}

/**
 * Check if path should have filename-as-date applied
 * Based on folder scope configuration
 */
export function shouldApplyFilenameDate(
  path: string,
  scopeFolders: string[],
  excludeFolders: string[] = []
): boolean {
  // Check if path is in excluded folders
  for (const exclude of excludeFolders) {
    if (path.includes(exclude)) {
      return false;
    }
  }
  
  // If no scope folders specified, apply to all
  if (!scopeFolders || scopeFolders.length === 0) {
    return true;
  }
  
  // Check if path is in scope folders
  for (const folder of scopeFolders) {
    if (path.includes(folder)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract filename from full path
 */
export function getFilenameFromPath(path: string): string {
  // Handle both Windows and Unix paths
  const parts = path.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Apply filename date to task if conditions are met
 * Returns the date to use (filename date or existing date)
 */
export function applyFilenameDate(
  taskPath: string,
  taskScheduledDate: string | undefined,
  taskDueDate: string | undefined,
  taskStartDate: string | undefined,
  config: {
    enabled: boolean;
    scopeFolders: string[];
    excludeFolders?: string[];
    preferredField: 'scheduled' | 'due' | 'start';
  }
): { scheduled?: string; due?: string; start?: string } {
  const result = {
    scheduled: taskScheduledDate,
    due: taskDueDate,
    start: taskStartDate,
  };
  
  // Feature disabled
  if (!config.enabled) {
    return result;
  }
  
  // Task already has the preferred date field
  if (config.preferredField === 'scheduled' && taskScheduledDate) return result;
  if (config.preferredField === 'due' && taskDueDate) return result;
  if (config.preferredField === 'start' && taskStartDate) return result;
  
  // Check if path is in scope
  if (!shouldApplyFilenameDate(taskPath, config.scopeFolders, config.excludeFolders)) {
    return result;
  }
  
  // Extract filename
  const filename = getFilenameFromPath(taskPath);
  
  // Parse date
  const filenameDate = parseDateFromFilename(filename);
  if (!filenameDate) {
    return result;
  }
  
  // Apply to preferred field
  if (config.preferredField === 'scheduled') {
    result.scheduled = filenameDate;
  } else if (config.preferredField === 'due') {
    result.due = filenameDate;
  } else {
    result.start = filenameDate;
  }
  
  return result;
}
