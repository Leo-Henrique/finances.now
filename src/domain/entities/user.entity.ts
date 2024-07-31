import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityDefinition,
  EntityInstance,
} from "@/core/@types/entity";
import { BaseEntity } from "@/core/entities/base-entity";
import { z } from "zod";
import { Name } from "./value-objects/name";
import { Password } from "./value-objects/password";

export type User = EntityInstance<UserEntity>;

export type UserData = EntityData<UserEntity>;

export type UserDataCreate = EntityDataCreate<UserEntity>;

export type UserDataUpdate = EntityDataUpdate<UserEntity>;

export type UserDataUpdated = EntityDataUpdated<UserEntity>;

export class UserEntity
  extends BaseEntity
  implements EntityDefinition<UserEntity>
{
  defineName() {
    return {
      schema: Name.schema,
      transform: (val: string) => new Name(val),
    };
  }

  defineEmail() {
    return { schema: z.string().email() };
  }

  definePassword() {
    return {
      schema: Password.schema,
      transform: (val: string) => new Password(val),
    };
  }

  get serialized() {
    // eslint-disable-next-line
    const { password, ...rest } = this.getData<UserEntity>();

    return rest;
  }

  public static create(input: UserDataCreate) {
    return new this().createEntity(input);
  }

  public static get baseSchema() {
    return new this().baseSchema;
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
