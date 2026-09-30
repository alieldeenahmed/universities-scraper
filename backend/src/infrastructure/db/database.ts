export type Row = Record<string, any>;

export interface QueryResult<T extends Row = Row> {
  rows: T[];
  rowCount: number;
}

export interface Queryable {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/** The little bit of Postgres the repositories need. Two implementations: pg and PGlite. */
export interface Database extends Queryable {
  /** runs several statements at once (migrations). No parameters. */
  exec(text: string): Promise<void>;
  transaction<T>(work: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
