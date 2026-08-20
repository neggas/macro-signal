declare module "node:sqlite" {
  export interface StatementResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): StatementResult;
  }

  export class DatabaseSync {
    constructor(
      path: string,
      options?: { open?: boolean; enableForeignKeyConstraints?: boolean }
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}
