import { z } from "zod";
import {
  EntityData,
  EntityDataCreate,
  EntityDataCreateZodShape,
  EntityDataUpdate,
  EntityDataUpdateZodShape,
  EntityDataZodShape,
  EntityInstance,
  EntityUnknownDefinition,
} from "../@types/entity";

export const definitionMethodName = "define" as const;

export abstract class Entity {
  protected get createSchema() {
    const { schemas } = this.mountFields();

    return schemas.create;
  }

  protected get baseSchema() {
    const { schemas } = this.mountFields();

    return schemas.base;
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
    const baseSchemaShape: Record<string, z.ZodType> = {};
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
        const fieldDefinition = entity[propName]();

        baseSchemaShape[fieldName] = fieldDefinition.schema;

        if ("default" in fieldDefinition)
          mountedFields.standard[fieldName] = fieldDefinition.default;

        if ("transform" in fieldDefinition) {
          const transformWithDefaultValue = () => {
            mountedFields.transformed[fieldName] = fieldDefinition.transform!(
              fieldDefinition.default,
            );
          };

          if (fieldName in input) {
            const value = input[fieldName as keyof typeof input];
            const parsedValue = fieldDefinition.schema.safeParse(value);
            const isUndefinedValueAndSchemaInvalid = !parsedValue.success;

            if (isUndefinedValueAndSchemaInvalid) {
              transformWithDefaultValue();
            } else {
              mountedFields.transformed[fieldName] =
                fieldDefinition.transform!(value);
            }
          } else if ("default" in fieldDefinition) {
            transformWithDefaultValue();
          }
        }

        if (!fieldDefinition.static) {
          createSchemaShape[fieldName] = fieldDefinition.schema;

          if ("default" in fieldDefinition) {
            createSchemaShape[fieldName] = fieldDefinition.schema.default(
              fieldDefinition.default,
            );
          }
        }

        if (!fieldDefinition.readonly)
          updateSchemaShape[fieldName] = fieldDefinition.schema.optional();
      }
    }

    return {
      mountedFields,
      schemas: {
        base: z.object(baseSchemaShape as EntityDataZodShape<this>),
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
        {} as {
          [K in keyof (Input | EntityData<this>)]: EntityData<this>[K];
        },
      );

    Object.assign(this, distinctFieldsFromOriginals);

    if ("updatedAt" in this) this.updatedAt = new Date();

    return distinctFieldsFromOriginals;
  }
}
