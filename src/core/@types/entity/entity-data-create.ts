import { Entity } from "@/core/entities/entity";
import { ConditionalKeys } from "type-fest";
import { z } from "zod";
import { FieldName, GetFieldDefinition } from "./entity-base";

type StaticFieldNames<Class extends Entity> = ConditionalKeys<
  {
    [K in keyof Class as FieldName<K>]:
      | undefined
      | false extends GetFieldDefinition<Class[K], "static">
      ? GetFieldDefinition<Class[K], "schema">
      : null;
  },
  null
>;

export type EntityDataCreateZodShape<Class extends Entity> = {
  [K in keyof Class as FieldName<K> extends StaticFieldNames<Class>
    ? never
    : FieldName<K>]: undefined extends GetFieldDefinition<Class[K], "default">
    ? GetFieldDefinition<Class[K], "schema">
    : z.ZodOptional<z.ZodDefault<GetFieldDefinition<Class[K], "schema">>>;
};

export type EntityDataCreate<Class extends Entity> = z.infer<
  z.ZodObject<{
    [K in keyof Class as FieldName<K> extends StaticFieldNames<Class>
      ? never
      : FieldName<K>]: undefined extends GetFieldDefinition<Class[K], "default">
      ? GetFieldDefinition<Class[K], "schema">
      : z.ZodOptional<GetFieldDefinition<Class[K], "schema">>;
  }>
>;

export type EntityDataCreateReference<Class extends Entity> = Omit<
  z.infer<
    z.ZodObject<{
      [K in keyof Class as FieldName<K>]: GetFieldDefinition<
        Class[K],
        "schema"
      >;
    }>
  >,
  "id"
>;
