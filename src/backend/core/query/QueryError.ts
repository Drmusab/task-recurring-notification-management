export class QuerySyntaxError extends Error {
  constructor(
    message: string,
    public line: number,
    public column: number,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'QuerySyntaxError';
  }
}

export class QueryExecutionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'QueryExecutionError';
  }
}
