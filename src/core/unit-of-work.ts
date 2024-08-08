export abstract class UnitOfWork {
  abstract begin(): Promise<void>;
  abstract commit(): Promise<void>;
  abstract rollback(): Promise<void>;
  abstract transaction<T>(work: () => Promise<T>): Promise<T>;
}
