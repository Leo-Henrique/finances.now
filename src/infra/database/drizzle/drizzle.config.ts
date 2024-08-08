import { env } from "@/infra/env";
import { defineConfig } from "drizzle-kit";
import { resolve } from "path";

export default defineConfig({
  schema: resolve(__dirname, "./schemas/*.schema.ts"),
  out: resolve(__dirname, "./migrations"),
  dialect: "postgresql",
  dbCredentials: {
    user: env.POSTGRES_USERNAME,
    password: env.POSTGRES_PASSWORD,
    host: env.POSTGRES_HOSTNAME,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DATABASE,
    ssl: false,
  },
  verbose: true,
  strict: true,
});
