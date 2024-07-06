import { UnitOfWork } from "@/core/unit-of-work";

export class FakeUnitOfWork implements UnitOfWork {
  public async begin() {}

  public async commit() {}

  public async rollback() {}

  public async transaction<T>(work: () => Promise<T>) {
    return await work();
  }
}
