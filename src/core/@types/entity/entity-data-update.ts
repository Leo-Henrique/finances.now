import { Entity } from "@/core/entities/entity";
import { ConditionalKeys } from "type-fest";
import { z } from "zod";
import { FieldName, GetFieldDefinition } from "./entity-base";
import { EntityData } from "./entity-data";

type ReadonlyFieldNames<Class extends Entity> = ConditionalKeys<
  {
    [K in keyof Class as FieldName<K>]:
      | undefined
      | false extends GetFieldDefinition<Class[K], "readonly">
      ? GetFieldDefinition<Class[K], "schema">
      : null;
  },
  null
>;

export type EntityDataUpdateZodShape<Class extends Entity> = {
  [K in keyof Class as FieldName<K> extends ReadonlyFieldNames<Class>
    ? never
    : FieldName<K>]: z.ZodOptional<GetFieldDefinition<Class[K], "schema">>;
};

export type EntityDataUpdate<Class extends Entity> = z.infer<
  z.ZodObject<EntityDataUpdateZodShape<Class>>
>;

export type EntityDataUpdated<Class extends Entity> = {
  [K in keyof EntityDataUpdate<Class>]: EntityData<Class>[K];
};
