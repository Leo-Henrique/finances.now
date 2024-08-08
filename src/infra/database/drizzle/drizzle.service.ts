import { Mapper } from "@/core/mapper";
import { env } from "@/infra/env";
import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { SQLWrapper } from "drizzle-orm";
import { NodePgDatabase, drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

@Injectable()
export class DrizzleService implements OnModuleInit, OnModuleDestroy {
  public readonly nodePostgresClient = new Client({
    user: env.POSTGRES_USERNAME,
    password: env.POSTGRES_PASSWORD,
    host: env.POSTGRES_HOSTNAME,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DATABASE,
    connectionTimeoutMillis: 2000,
  });
  private readonly client: NodePgDatabase;

  public constructor() {
    this.client = drizzle(this.nodePostgresClient, {
      logger: env.NODE_ENV === "development",
    });
  }

  public async query<
    RowResult extends Record<string, unknown> | unknown = unknown,
  >(sql: SQLWrapper) {
    const { rows } = await this.client.execute(sql);
    const result = [];

    for (const row of rows) {
      result.push(Mapper.toCamelCaseProperties(row));
    }

    return result as RowResult[];
  }

  public onModuleInit() {
    return this.nodePostgresClient.connect();
  }

  public onModuleDestroy() {
    return this.nodePostgresClient.end();
  }
}
