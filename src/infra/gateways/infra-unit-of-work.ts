import { UnitOfWork } from "@/core/unit-of-work";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../database/drizzle/drizzle.service";

@Injectable()
export class InfraUnitOfWork implements UnitOfWork {
  public constructor(private readonly drizzle: DrizzleService) {}

  public async begin(): Promise<void> {
    await this.drizzle.query(sql`BEGIN`);
  }

  public async commit(): Promise<void> {
    await this.drizzle.query(sql`COMMIT`);
  }

  public async rollback(): Promise<void> {
    await this.drizzle.query(sql`ROLLBACK`);
  }

  public async transaction<T>(work: () => Promise<T>): Promise<T> {
    try {
      await this.begin();

      const workResult = await work();

      await this.commit();

      return workResult;
    } catch (error) {
      await this.rollback();

      throw error;
    }
  }
}
