export enum StatusType {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
  NON_TASK = 'NON_TASK',
  EMPTY = 'EMPTY',
}

export interface StatusConfiguration {
  /** The character inside [ ] */
  symbol: string;
  /** Human-readable name */
  name: string;
  /** Symbol to transition to on toggle */
  nextStatusSymbol: string;
  /** The type category */
  type: StatusType;
}

export class Status {
  public readonly symbol: string;
  public readonly name: string;
  public readonly nextStatusSymbol: string;
  public readonly type: StatusType;

  constructor(config: StatusConfiguration) {
    this.symbol = config.symbol;
    this.name = config.name;
    this.nextStatusSymbol = config.nextStatusSymbol;
    this.type = config.type;
  }

  // Static default statuses
  static readonly TODO = new Status({ symbol: ' ', name: 'Todo', nextStatusSymbol: 'x', type: StatusType.TODO });
  static readonly DONE = new Status({ symbol: 'x', name: 'Done', nextStatusSymbol: ' ', type: StatusType.DONE });
  static readonly IN_PROGRESS = new Status({ symbol: '/', name: 'In Progress', nextStatusSymbol: 'x', type: StatusType.IN_PROGRESS });
  static readonly CANCELLED = new Status({ symbol: '-', name: 'Cancelled', nextStatusSymbol: ' ', type: StatusType.CANCELLED });

  /** Get status type for unknown symbols */
  static getTypeForUnknownSymbol(symbol: string): StatusType {
    switch (symbol) {
      case 'x':
      case 'X':
        return StatusType.DONE;
      case '/':
        return StatusType.IN_PROGRESS;
      case '-':
        return StatusType.CANCELLED;
      case ' ':
      default:
        return StatusType.TODO;
    }
  }

  /** Check if this status represents a completed state */
  isCompleted(): boolean {
    return this.type === StatusType.DONE || this.type === StatusType.CANCELLED;
  }
}
