import { z } from "zod";
import {
  EntityData,
  EntityDataCreate,
  EntityDataCreateZodShape,
  EntityDataEarlyUpdate,
  EntityDataUpdate,
  EntityDataUpdateZodShape,
  EntityDataZodShape,
  EntityInstance,
  EntityUnknownDefinition,
  ExtractFieldDefinitionInput,
  ExtractFieldDefinitionOutput,
  FieldDefinition,
} from "../@types/entity";
import { UniqueEntityId } from "./unique-entity-id";

export const definitionMethodName = "define" as const;

export abstract class Entity {
  protected get baseSchema() {
    const { schemas } = this.mountFields();

    return schemas.base;
  }

  public get createSchema() {
    const { schemas } = this.mountFields();

    return schemas.create;
  }

  protected get updateSchema() {
    const { schemas } = this.mountFields();

    return schemas.update;
  }

  protected getData<Class extends Entity>() {
    return this as unknown as EntityData<Class>;
  }

  private mountFields(
    input: object = {},
    options: { isCreation?: boolean } = {},
  ) {
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
    const schemas: {
      baseShape: Record<string, z.ZodType>;
      createShape: Record<string, z.ZodType>;
      updateShape: Record<string, z.ZodType>;
    } = {
      baseShape: {},
      createShape: {},
      updateShape: {},
    };
    const events = {
      definition: [() => {}],
    };

    for (const entity of classes) {
      const definitionPropertyNames = Object.getOwnPropertyNames(entity).filter(
        name => name.startsWith(definitionMethodName),
      ) as (keyof EntityUnknownDefinition)[];

      for (const propName of definitionPropertyNames) {
        const pascalCaseFieldName = propName.replace(definitionMethodName, "");
        const fieldName =
          pascalCaseFieldName[0].toLowerCase() + pascalCaseFieldName.slice(1);
        const currentFieldValue = this[fieldName as keyof EntityData<this>];
        const fieldDefinition = entity[propName].bind(this)();
        const inputValue = input[fieldName as keyof typeof input];
        const isUndefinedInputAndSchemaInvalid = () => {
          const parsedValue = fieldDefinition.schema.safeParse(inputValue);

          return fieldName in input && !parsedValue.success;
        };

        if (options.isCreation) {
          if ("default" in fieldDefinition) {
            mountedFields.standard[fieldName] = fieldDefinition.default;
          }

          if (fieldDefinition.transform) {
            if (isUndefinedInputAndSchemaInvalid()) {
              mountedFields.transformed[fieldName] = fieldDefinition.transform!(
                fieldDefinition.default,
              );
            } else if (fieldName in input) {
              mountedFields.transformed[fieldName] =
                fieldDefinition.transform(inputValue);
            } else if ("default" in fieldDefinition) {
              mountedFields.transformed[fieldName] = fieldDefinition.transform!(
                fieldDefinition.default,
              );
            }
          }
        } else {
          if (fieldDefinition.transform) {
            if (isUndefinedInputAndSchemaInvalid()) {
              mountedFields.transformed[fieldName] = currentFieldValue;
            } else if (fieldName in input) {
              mountedFields.transformed[fieldName] =
                fieldDefinition.transform(inputValue);
            }
          }
        }

        const fieldHasBeenDefined = () => {
          const fieldCreatedWithDefaultValue =
            options.isCreation && "default" in fieldDefinition;

          if (isUndefinedInputAndSchemaInvalid())
            return fieldCreatedWithDefaultValue;

          if (fieldName in input) return true;

          if (fieldCreatedWithDefaultValue) return true;

          return false;
        };

        if (fieldDefinition.onDefinition && fieldHasBeenDefined())
          events.definition.push(() => fieldDefinition.onDefinition!());

        schemas.baseShape[fieldName] = fieldDefinition.schema;

        if (!fieldDefinition.static) {
          schemas.createShape[fieldName] = fieldDefinition.schema;

          if ("default" in fieldDefinition) {
            schemas.createShape[fieldName] = fieldDefinition.schema.default(
              fieldDefinition.default,
            );
          }
        }

        if (!fieldDefinition.readonly)
          schemas.updateShape[fieldName] = fieldDefinition.schema.optional();
      }
    }

    return {
      mountedFields,
      schemas: {
        base: z.object(schemas.baseShape as EntityDataZodShape<this>),
        create: z.object(schemas.createShape as EntityDataCreateZodShape<this>),
        update: z.object(schemas.updateShape as EntityDataUpdateZodShape<this>),
      },
      events,
    };
  }

  /**
   * Utility to define field definition. Used only for intellisense.
   *
   * @param params - Options for definition field.
   */
  protected createField<
    T extends FieldDefinition<
      ExtractFieldDefinitionInput<T>,
      ExtractFieldDefinitionOutput<T>
    >,
  >(
    params: {
      /**
       * A Zod schema that defines the type and/or restrictions on the field.
       *
       * By default, types are considered in:
       * - ```EntityInstance```
       * - ```EntityData```
       * - ```EntityDataCreate```
       * - ```EntityDataUpdate```
       * - ```EntityDataUpdated```
       *
       * By default, the schema is considered in:
       * - ```baseSchema```
       * - ```createSchema```
       * - ```updateSchema```
       *
       * @example
       * ```
       * defineName() {
       *    return this.createField({
       *      schema: z.string(),
       *    });
       * })
       * ```
       */
      schema: T["schema"];
      /**
       * A value used as default when creating the entity with ```ExampleEntity.create()``` if no explicit value is provided.
       *
       * The type must respect the zod schema type of the ```schema``` field.
       *
       * @example
       * ```
       * defineName() {
       *    return this.createField({
       *      schema: z.string().nullable(),
       *      default: null,
       *    });
       * })
       * ```
       */
      default?: T["default"];
      /**
       * A function executed when creating or updating the corresponding field that transforms the received value with the value returned from the function.
       *
       * @param value - The value passed when creating or updating the field (the type must respect the zod schema type of the ```schema``` field).
       *
       * @returns The new value that will be considered for the field. The returned type is now considered in:
       * - ```EntityInstance```
       * - ```EntityData```
       * - ```EntityDataUpdated```
       *
       * @example
       * ```
       * defineId() {
       *    return this.createField({
       *      schema: z.string(),
       *      transform: (value: string) => new UniqueEntityId(value);
       *    });
       * })
       * ```
       */
      transform?: T["transform"];
      /**
       * Defines a field that cannot be created.
       *
       * A static field implies:
       *
       * - Disregard the ```EntityDataCreate``` field types
       * - Disregard the ```createSchema``` schema field
       *
       * @default false
       *
       * @example
       * ```
       * defineId() {
       *    return this.createField({
       *      schema: z.string(),
       *      static: true
       *    });
       * }
       * ```
       */
      static?: T["static"];
      /**
       * Defines a field that cannot be updated.
       *
       * A readonly field implies:
       *
       * - Disregard the ```EntityDataUpdate``` and ```EntityDataUpdated``` field types
       * - Disregard the ```updateSchema``` schema field
       * - Do not allow updating the field with ```ExampleEntity.update()```
       *
       * @default false
       *
       * @example
       * ```
       * defineId() {
       *    return {
       *      schema: z.string(),
       *      static: true
       *    } satisfies FieldDefinition<string>;
       * }
       * ```
       */
      readonly?: T["readonly"];
      /**
       * A function that is always executed after the field is created or updated.
       *
       * It also fires when the field was not defined when creating the entity, but it has the ```default``` field.
       *
       * Useful for updating another fields that depend on the field that ```onDefinition``` was used for.
       *
       * @example
       * ```
       * export class UserEntity extends Entity {
       *   defineSlug() {
       *     return this.createField({
       *       schema: z.string(),
       *       transform: (value: string) => new Slug(value),
       *       static: true,
       *       readonly: true,
       *     });
       *   }
       *
       *   defineName() {
       *     return this.createField({
       *       schema: z.string(),
       *       onDefinition: () => {
       *         const { name } = this.getData<UserEntity>();
       *
       *         this.earlyUpdate<UserEntity>({ slug: name });
       *       },
       *     });
       *   }
       * }
       * ```
       */
      onDefinition?: () => void;
    } & T,
  ): T {
    return params;
  }

  protected createEntity(input: EntityDataCreate<this>) {
    const { mountedFields, events } = this.mountFields(input, {
      isCreation: true,
    });
    const fields = {
      ...mountedFields.standard,
      ...input,
      ...mountedFields.transformed,
    };

    Object.assign(this, fields);

    for (const definitionEvent of events.definition) definitionEvent();

    return this as unknown as EntityInstance<this>;
  }

  public update<Input extends EntityDataUpdate<this>>(
    input: Input,
    options: { unsafe?: boolean; isEarly?: boolean } = {},
  ) {
    const { mountedFields, events } = this.mountFields(input, {
      isCreation: false,
    });
    let inputFields = input;

    if (!options.unsafe)
      inputFields = { ...input, ...mountedFields.transformed };

    const inputFieldNames = Object.keys(inputFields) as (keyof Input)[];
    const distinctFieldsFromOriginals = inputFieldNames
      .filter(fieldName => {
        const originalField = this[fieldName as keyof EntityData<this>];

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

    if (!options.isEarly) {
      if ("updatedAt" in this) this.updatedAt = new Date();

      for (const definitionEvent of events.definition) definitionEvent();
    }

    return distinctFieldsFromOriginals;
  }

  protected earlyUpdate<Class extends Entity>(
    input: EntityDataEarlyUpdate<Class>,
  ) {
    this.update(input as unknown as EntityDataUpdate<this>, { isEarly: true });
  }

  public clone() {
    const clone = Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      this,
    ) as unknown as EntityInstance<this>;

    if ("id" in clone && clone.id instanceof UniqueEntityId)
      clone.id = new UniqueEntityId();

    return clone;
  }
}
