/**
 * Task Status System with User-Defined Registry
 * Supports custom checkbox symbols and toggle cycles
 */

/**
 * Status type classification for business logic
 */
export enum StatusType {
  TODO = 'TODO',               // Open task, counts toward active
  IN_PROGRESS = 'IN_PROGRESS', // Open task, actively being worked on
  DONE = 'DONE',               // Completed task, triggers done date & recurrence
  CANCELLED = 'CANCELLED',     // Cancelled task, triggers cancelled date, stops recurrence
  NON_TASK = 'NON_TASK',       // Not a task (e.g., note, question mark)
}

/**
 * Status definition in the registry
 */
export interface Status {
  /** Character inside checkbox (e.g., ' ', 'x', '/', '-', '>') */
  symbol: string;
  
  /** Display name (e.g., "To Do", "Done", "In Progress") */
  name: string;
  
  /** Status type for business logic classification */
  type: StatusType;
  
  /** Next symbol in toggle cycle (what happens when user clicks checkbox) */
  nextSymbol: string;
  
  /** Optional color for UI display */
  color?: string;
  
  /** Optional icon or emoji */
  icon?: string;
}

/**
 * Default status definitions (Obsidian Tasks compatible)
 */
export const DEFAULT_STATUSES: Status[] = [
  {
    symbol: ' ',
    name: 'To Do',
    type: StatusType.TODO,
    nextSymbol: 'x',
    color: '#808080',
  },
  {
    symbol: 'x',
    name: 'Done',
    type: StatusType.DONE,
    nextSymbol: ' ',
    color: '#00AA00',
  },
  {
    symbol: '/',
    name: 'In Progress',
    type: StatusType.IN_PROGRESS,
    nextSymbol: 'x',
    color: '#FFA500',
  },
  {
    symbol: '-',
    name: 'Cancelled',
    type: StatusType.CANCELLED,
    nextSymbol: ' ',
    color: '#AA0000',
  },
  {
    symbol: '>',
    name: 'Forwarded',
    type: StatusType.TODO,
    nextSymbol: 'x',
    color: '#0080FF',
  },
  {
    symbol: '!',
    name: 'Important',
    type: StatusType.TODO,
    nextSymbol: 'x',
    color: '#FF0000',
  },
  {
    symbol: '?',
    name: 'Question',
    type: StatusType.NON_TASK,
    nextSymbol: ' ',
    color: '#8000FF',
  },
];

/**
 * StatusRegistry manages user-defined task statuses
 * Singleton pattern for global access
 */
export class StatusRegistry {
  private static instance: StatusRegistry | null = null;
  private statuses: Map<string, Status> = new Map();
  
  private constructor() {
    this.loadDefaults();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): StatusRegistry {
    if (!StatusRegistry.instance) {
      StatusRegistry.instance = new StatusRegistry();
    }
    return StatusRegistry.instance;
  }
  
  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    StatusRegistry.instance = null;
  }
  
  /**
   * Load default statuses
   */
  private loadDefaults(): void {
    DEFAULT_STATUSES.forEach(status => {
      this.statuses.set(status.symbol, status);
    });
  }
  
  /**
   * Get status by symbol
   * Returns "Unknown" status if symbol not found
   */
  get(symbol: string): Status {
    const status = this.statuses.get(symbol);
    
    if (status) {
      return status;
    }
    
    // Unknown symbol - create safe default
    return {
      symbol,
      name: 'Unknown',
      type: StatusType.NON_TASK,
      nextSymbol: 'x',
      color: '#999999',
    };
  }
  
  /**
   * Add or update a status
   */
  set(status: Status): void {
    this.statuses.set(status.symbol, status);
  }
  
  /**
   * Remove a status
   */
  remove(symbol: string): void {
    this.statuses.delete(symbol);
  }
  
  /**
   * Get all statuses
   */
  getAll(): Status[] {
    return Array.from(this.statuses.values());
  }
  
  /**
   * Check if symbol exists
   */
  has(symbol: string): boolean {
    return this.statuses.has(symbol);
  }
  
  /**
   * Get next status in toggle cycle
   */
  getNext(currentSymbol: string): Status {
    const current = this.get(currentSymbol);
    return this.get(current.nextSymbol);
  }
  
  /**
   * Load custom statuses from settings
   */
  loadFromSettings(customStatuses: Status[]): void {
    this.statuses.clear();
    this.loadDefaults();
    
    customStatuses.forEach(status => {
      this.statuses.set(status.symbol, status);
    });
  }
  
  /**
   * Export to settings format
   */
  exportToSettings(): Status[] {
    return this.getAll();
  }
  
  /**
   * Validate status configuration
   */
  validate(): string[] {
    const errors: string[] = [];
    const symbols = new Set<string>();
    
    for (const status of this.statuses.values()) {
      // Check for duplicate symbols
      if (symbols.has(status.symbol)) {
        errors.push(`Duplicate status symbol: ${status.symbol}`);
      }
      symbols.add(status.symbol);
      
      // Check if nextSymbol exists or will create infinite loop
      if (!this.statuses.has(status.nextSymbol) && status.nextSymbol !== status.symbol) {
        errors.push(`Status '${status.name}' has invalid nextSymbol: ${status.nextSymbol}`);
      }
      
      // Check for immediate cycles (A -> A is allowed for non-toggling statuses)
      // But long cycles (A -> B -> A) are allowed
    }
    
    return errors;
  }
  
  /**
   * Map StatusType to task status string
   */
  mapTypeToStatus(type: StatusType): 'todo' | 'done' | 'cancelled' {
    switch (type) {
      case StatusType.TODO:
      case StatusType.IN_PROGRESS:
        return 'todo';
      case StatusType.DONE:
        return 'done';
      case StatusType.CANCELLED:
        return 'cancelled';
      default:
        return 'todo';
    }
  }
}
