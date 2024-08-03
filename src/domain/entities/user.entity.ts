import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
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

export class UserEntity extends BaseEntity {
  defineName() {
    return this.createField({
      schema: Name.schema,
      transform: (val: string) => new Name(val),
    });
  }

  defineEmail() {
    return this.createField({
      schema: z.string().email(),
    });
  }

  definePassword() {
    return this.createField({
      schema: Password.schema,
      transform: (val: string) => new Password(val),
    });
  }

  defineActivatedAt() {
    return this.createField({
      schema: z.date().nullable(),
      default: null,
    });
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
