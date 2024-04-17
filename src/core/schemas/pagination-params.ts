import { z } from "zod";

export const paginationParamsSchema = z.object({
  items: z.coerce.number().int().min(1).max(50),
  page: z.coerce.number().int().min(1),
});

export type PaginationParams = z.infer<typeof paginationParamsSchema>;
