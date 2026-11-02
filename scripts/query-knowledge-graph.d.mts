export interface QueryResultNode {
  id: string;
  name: string;
  file?: string;
  community?: string;
}

export interface QueryResultLink {
  symbol: string;
  file: string;
  relation: string;
  context: string;
  location: string;
}

export interface QueryResult {
  query: string;
  matchingNodes: QueryResultNode[];
  dependencies: QueryResultLink[];
  callers: QueryResultLink[];
}

export function queryDependencies(targetQuery: string): QueryResult;
export function formatQueryResult(result: QueryResult): string;
