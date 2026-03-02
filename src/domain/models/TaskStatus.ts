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
  readonly symbol: string;
  
  /** Display name (e.g., "To Do", "Done", "In Progress") */
  readonly name: string;
  
  /** Status type for business logic classification */
  readonly type: StatusType;
  
  /** Next symbol in toggle cycle (what happens when user clicks checkbox) */
  readonly nextSymbol: string;
  
  /** Optional color for UI display */
  readonly color?: string;
  
  /** Optional icon or emoji */
  readonly icon?: string;
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
 * StatusRegistry manages user-defined task statuses.
 * Singleton pattern — status data is immutable once loaded.
 * 
 * v2.0: Internal map is replaced wholesale (not mutated) on
 * loadFromSettings(). Individual set()/remove() rebuild the map
 * from scratch to preserve snapshot immutability.
 */
export class StatusRegistry {
  private static instance: StatusRegistry | null = null;
  /** Immutable status map — replaced, never mutated in-place */
  private statuses: ReadonlyMap<string, Status> = new Map();
  
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
   * Load default statuses (replaces map wholesale)
   */
  private loadDefaults(): void {
    const map = new Map<string, Status>();
    for (const status of DEFAULT_STATUSES) {
      map.set(status.symbol, Object.freeze(status));
    }
    this.statuses = map;
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
    
    // Unknown symbol - create safe default (frozen)
    return Object.freeze({
      symbol,
      name: 'Unknown',
      type: StatusType.NON_TASK,
      nextSymbol: 'x',
      color: '#999999',
    });
  }
  
  /**
   * Add or update a status — rebuilds map immutably
   */
  set(status: Status): void {
    const map = new Map(this.statuses);
    map.set(status.symbol, Object.freeze(status));
    this.statuses = map;
  }
  
  /**
   * Remove a status — rebuilds map immutably
   */
  remove(symbol: string): void {
    const map = new Map(this.statuses);
    map.delete(symbol);
    this.statuses = map;
  }
  
  /**
   * Get all statuses (frozen copies)
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
   * Load custom statuses from settings — replaces map wholesale
   */
  loadFromSettings(customStatuses: Status[]): void {
    const map = new Map<string, Status>();
    // Load defaults first
    for (const status of DEFAULT_STATUSES) {
      map.set(status.symbol, Object.freeze(status));
    }
    // Then overlay custom statuses
    for (const status of customStatuses) {
      map.set(status.symbol, Object.freeze(status));
    }
    this.statuses = map;
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
