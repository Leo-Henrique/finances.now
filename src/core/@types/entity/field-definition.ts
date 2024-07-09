import { z } from "zod";

export interface FieldDefinition<Input = unknown, Output = Input> {
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
   *    return {
   *      schema: z.string(),
   *    } satisfies FieldDefinition;
   * }
   * ```
   */
  schema: z.ZodType<Input>;
  /**
   * A value used as a default when not explicitly provided when creating the entity with ```ExampleEntity.create()```. The type must respect the ```schema``` field.
   *
   * @example
   * ```
   * defineName() {
   *    return {
   *      schema: z.string().nullable(),
   *      default: null,
   *    } satisfies FieldDefinition<string | null>;
   * }
   * ```
   */
  default?: Input;
  /**
   * A function that receives the value — with the type of ```schema``` field — defined when creating or updating the entity and uses the returned value to define the entity.
   *
   * The value of the ```default``` field is also transformed if it exists.
   *
   * The returned type is now considered in:
   *
   * - ```EntityInstance```
   * - ```EntityData```
   * - ```EntityDataUpdated```
   *
   * @example
   * ```
   * defineId() {
   *    return {
   *      schema: z.string(),
   *      transform: (value) => new UniqueEntityId(value);
   *    } satisfies FieldDefinition<string, UniqueEntityId>;
   * }
   * ```
   */
  transform?: (value: Input) => Output;
  /**
   * Defines a field that cannot be created.
   *
   * A static field implies:
   *
   * - Disregard the ```EntityDataCreate``` field types
   * - Disregard the ```createSchema``` schema field
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
   *
   * @default false
   */
  static?: boolean;
  /**
   * Defines a field that cannot be updated.
   *
   * A readonly field implies:
   *
   * - Disregard the ```EntityDataUpdate``` and ```EntityDataUpdated``` field types
   * - Disregard the ```updateSchema``` schema field
   * - Do not allow updating the field with ```ExampleEntity.update()```
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
   *
   * @default false
   */
  readonly?: boolean;
  /**
   * A function that is always executed after the field is created or updated.
   *
   * It also fires when the field was not defined when creating the entity, but it has the ```default``` field.
   *
   * Useful for updating another fields that depend on the field that ```onDefinition``` was used for.
   *
   * @example
   * ```
   * export class UserEntity extends Entity implements EntityDefinition<UserEntity> {
   *   defineSlug() {
   *     return {
   *       schema: z.string(),
   *       transform: value => new Slug(value),
   *       static: true,
   *       readonly: true,
   *     } satisfies FieldDefinition<string, Slug>;
   *   }
   *
   *   defineName() {
   *     return {
   *       schema: z.string(),
   *       onDefinition: () => {
   *         const { name } = this.getData<UserEntity>();
   *
   *         this.earlyUpdate<UserEntity>({ slug: name });
   *       },
   *     } satisfies FieldDefinition<string>;
   *   }
   * }
   * ```
   */
  onDefinition?: () => void;
}
