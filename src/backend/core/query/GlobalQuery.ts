import { QueryParser, type QueryAST } from "@backend/core/query/QueryParser";

export interface GlobalQueryConfig {
  enabled: boolean;
  query: string;
}

export const DEFAULT_GLOBAL_QUERY_CONFIG: GlobalQueryConfig = {
  enabled: false,
  query: '',
};

export class GlobalQuery {
  private static instance: GlobalQuery | null = null;
  private config: GlobalQueryConfig;
  private ast: QueryAST | null = null;
  private error: string | null = null;

  private constructor(config: GlobalQueryConfig = DEFAULT_GLOBAL_QUERY_CONFIG) {
    this.config = config;
    this.parse();
  }

  static getInstance(): GlobalQuery {
    if (!GlobalQuery.instance) {
      GlobalQuery.instance = new GlobalQuery();
    }
    return GlobalQuery.instance;
  }

  initialize(config: GlobalQueryConfig): void {
    this.config = config;
    this.parse();
  }

  updateConfig(config: GlobalQueryConfig): void {
    this.config = config;
    this.parse();
  }

  getConfig(): GlobalQueryConfig {
    return this.config;
  }

  isEnabled(): boolean {
    return this.config.enabled && this.config.query.trim().length > 0;
  }

  getAST(): QueryAST | null {
    return this.ast;
  }

  getError(): string | null {
    return this.error;
  }

  private parse(): void {
    if (!this.isEnabled()) {
      this.ast = null;
      this.error = null;
      return;
    }

    try {
      const parser = new QueryParser();
      this.ast = parser.parse(this.config.query);
      this.error = null;
    } catch (error) {
      this.ast = null;
      this.error = error instanceof Error ? error.message : String(error);
    }
  }
}
