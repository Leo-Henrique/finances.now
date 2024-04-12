import { z } from "zod";
import {
  EntityData,
  EntityDataCreate,
  EntityDataCreateZodShape,
  EntityDataUpdate,
  EntityDataUpdateZodShape,
  EntityInstance,
  EntityUnknownDefinition,
} from "../@types/entity";

export const definitionMethodName = "define" as const;

export abstract class Entity {
  protected get createSchema() {
    const { schemas } = this.mountFields();

    return schemas.create;
  }

  protected get updateSchema() {
    const { schemas } = this.mountFields();

    return schemas.update;
  }

  protected get entity() {
    return this as unknown as EntityInstance<this>;
  }

  private mountFields(input: object = {}) {
    const baseEntityProto = this.constructor.prototype;
    const classes: EntityUnknownDefinition[] = [baseEntityProto];
    const getExtendedClasses = (baseClass = baseEntityProto) => {
      const extendedClass = Object.getPrototypeOf(
        baseClass,
      ) as EntityUnknownDefinition;

      if (extendedClass instanceof Entity) {
        classes.unshift(extendedClass);

        getExtendedClasses(extendedClass);
      }
    };

    getExtendedClasses();

    const mountedFields: {
      standard: Record<string, unknown>;
      transformed: Record<string, unknown>;
    } = {
      standard: {},
      transformed: {},
    };
    const createSchemaShape: Record<string, z.ZodType> = {};
    const updateSchemaShape: Record<string, z.ZodType> = {};

    for (const entity of classes) {
      const definitionPropertyNames = Object.getOwnPropertyNames(entity).filter(
        name => name.startsWith(definitionMethodName),
      ) as (keyof EntityUnknownDefinition)[];

      for (const propName of definitionPropertyNames) {
        const pascalCaseFieldName = propName.replace(definitionMethodName, "");
        const fieldName =
          pascalCaseFieldName[0].toLowerCase() + pascalCaseFieldName.slice(1);
        const fieldSchema = entity[propName]();

        if (fieldSchema.transform && fieldName in input) {
          mountedFields.transformed[fieldName] = fieldSchema.transform(
            input[fieldName as keyof typeof input],
          );
        }

        if ("default" in fieldSchema)
          mountedFields.standard[fieldName] = fieldSchema.default;

        if (!fieldSchema.static)
          createSchemaShape[fieldName] = fieldSchema.schema;

        if (!fieldSchema.readonly)
          updateSchemaShape[fieldName] = fieldSchema.schema;
      }
    }

    return {
      mountedFields,
      schemas: {
        create: z.object(createSchemaShape as EntityDataCreateZodShape<this>),
        update: z.object(updateSchemaShape as EntityDataUpdateZodShape<this>),
      },
    };
  }

  protected createEntity(input: EntityDataCreate<this>) {
    const { mountedFields } = this.mountFields(input);
    const fields = {
      ...mountedFields.standard,
      ...input,
      ...mountedFields.transformed,
    };

    Object.assign(this, fields);

    return this.entity;
  }

  public update<Input extends EntityDataUpdate<this>>(input: Input) {
    const { mountedFields } = this.mountFields(input);
    const inputFields = { ...input, ...mountedFields.transformed };
    const distinctFieldsFromOriginals = Object.keys(inputFields)
      .filter(fieldName => {
        const originalField =
          this.entity[fieldName as keyof typeof this.entity];

        return inputFields[fieldName] !== originalField;
      })
      .reduce(
        (fields, distinctFieldName) => {
          const newValue = inputFields[
            distinctFieldName
          ] as (typeof fields)[keyof typeof fields];

          fields[distinctFieldName as keyof typeof fields] = newValue;

          return fields;
        },
        {} as Required<{
          [K in keyof (
            | Required<Input>
            | EntityData<this>
          )]: EntityData<this>[K];
        }>,
      );

    Object.assign(this, distinctFieldsFromOriginals);

    if ("updatedAt" in this) this.updatedAt = new Date();

    return distinctFieldsFromOriginals;
  }
}
