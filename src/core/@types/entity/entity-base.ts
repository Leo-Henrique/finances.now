import { Entity, definitionMethodName } from "@/core/entities/entity";
import { CamelCase } from "type-fest";
import { z } from "zod";
import { EntityData } from "./entity-data";
import { FieldDefinition } from "./field-definition";

export type FieldName<PropName> =
  PropName extends `${typeof definitionMethodName}${infer FieldName}`
    ? CamelCase<FieldName>
    : never;

export type GetFieldDefinition<
  Method,
  Key extends keyof FieldDefinition,
> = Method extends (
  ...args: any // eslint-disable-line
) => any // eslint-disable-line
  ? ReturnType<Method>[Key]
  : never;

type FieldInput<Method> = z.infer<GetFieldDefinition<Method, "schema">>;

type FieldOutput<Method> =
  GetFieldDefinition<Method, "transform"> extends Function // eslint-disable-line
    ? ReturnType<GetFieldDefinition<Method, "transform">>
    : z.infer<GetFieldDefinition<Method, "schema">>;

export type EntityUnknownDefinition = {
  [key: `${typeof definitionMethodName}${string}`]: () => FieldDefinition;
};

export type EntityDefinition<Class extends Entity> = {
  [K in keyof Class as K extends `${typeof definitionMethodName}${string}`
    ? K
    : never]: () => FieldDefinition<
    FieldInput<Class[K]>,
    FieldOutput<Class[K]>
  >;
};

export type InstanceWithoutDefinitions<Class extends Entity> = {
  [K in keyof Class as K extends `${typeof definitionMethodName}${string}`
    ? never
    : K]: Class[K];
};

export type EntityInstance<Class extends Entity> =
  InstanceWithoutDefinitions<Class> & EntityData<Class>;
