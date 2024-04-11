import { Entity } from "@/core/entities/entity";
import { z } from "zod";
import { FieldName, GetFieldDefinition } from "./entity-base";

export type EntityDataZodShape<Class extends Entity> = {
  [K in keyof Class as FieldName<K>]: GetFieldDefinition<Class[K], "schema">;
};

export type EntityData<Class extends Entity> = z.infer<
  z.ZodObject<{
    [K in keyof Class as FieldName<K>]: GetFieldDefinition<
      Class[K],
      "transform"
    > extends Function // eslint-disable-line
      ? z.ZodType<ReturnType<GetFieldDefinition<Class[K], "transform">>>
      : GetFieldDefinition<Class[K], "schema">;
  }>
>;
