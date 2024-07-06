export interface UnitOfWork {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
}
