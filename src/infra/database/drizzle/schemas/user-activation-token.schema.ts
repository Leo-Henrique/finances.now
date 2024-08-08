import { UserActivationTokenData } from "@/domain/entities/user-activation-token.entity";
import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import * as ddl from "drizzle-orm/pg-core";
import { drizzleUserTable } from "./user.schema";

export type DrizzleUserActivationTokenData = InferSelectModel<
  typeof drizzleUserActivationTokenTable
>;

export type DrizzleUserActivationTokenDataCreate = InferInsertModel<
  typeof drizzleUserActivationTokenTable
>;

export const drizzleUserActivationTokenTable = ddl.pgTable(
  "user_activation_tokens",
  {
    userId: ddl
      .uuid("user_id")
      .notNull()
      .references(() => drizzleUserTable.id),
    token: ddl.text("token").notNull(),
    expiresAt: ddl.timestamp("expires_at").notNull(),
  } satisfies Record<keyof UserActivationTokenData, ddl.PgColumnBuilderBase>,
);
