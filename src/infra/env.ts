import packageJson from "@/../package.json";
import { config } from "dotenv";
import { z } from "zod";

config({ override: true });

const schema = z.object({
  NODE_ENV: z.enum(["test", "development", "production"]),
  API_NAME: z.string().default(packageJson.name),
  API_PORT: z.coerce.number().default(3333),
  API_ACCESS_PERMISSION_CLIENT_SIDE: z.string().default("*"),
  POSTGRES_USERNAME: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_HOSTNAME: z.string(),
  POSTGRES_PORT: z.coerce.number(),
  POSTGRES_DATABASE: z.string(),
});

const parsedEnv = schema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(parsedEnv.error.flatten().fieldErrors);

  throw new Error("Invalid environment variables.");
}

export const env = parsedEnv.data;
