import { QueryParser, type QueryAST } from "@backend/core/query/QueryParser";

export interface QueryCompositionResult {
  ast: QueryAST;
  ignoredGlobal: boolean;
}

export class QueryComposer {
  private parser: QueryParser;

  constructor(parser?: QueryParser) {
    this.parser = parser ?? new QueryParser();
  }

  compose(localQuery: string, globalQueryAST: QueryAST | null): QueryCompositionResult {
    const { query, ignoreGlobal } = this.stripIgnoreDirective(localQuery);
    const localAST = this.parser.parse(query);

    if (!ignoreGlobal && globalQueryAST && globalQueryAST.filters.length > 0) {
      return {
        ast: {
          ...localAST,
          filters: [...globalQueryAST.filters, ...localAST.filters],
        },
        ignoredGlobal: false,
      };
    }

    return {
      ast: localAST,
      ignoredGlobal: ignoreGlobal,
    };
  }

  private stripIgnoreDirective(query: string): { query: string; ignoreGlobal: boolean } {
    const lines = query.split('\n');
    const filtered: string[] = [];
    let ignoreGlobal = false;

    for (const line of lines) {
      if (/^ignore global query$/i.test(line.trim())) {
        ignoreGlobal = true;
        continue;
      }
      filtered.push(line);
    }

    return { query: filtered.join('\n'), ignoreGlobal };
  }
}
