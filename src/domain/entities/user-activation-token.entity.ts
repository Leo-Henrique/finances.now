import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityInstance,
} from "@/core/@types/entity";
import { Entity } from "@/core/entities/entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { z } from "zod";

export type UserActivationToken = EntityInstance<UserActivationTokenEntity>;

export type UserActivationTokenData = EntityData<UserActivationTokenEntity>;

export type UserActivationTokenDataCreate =
  EntityDataCreate<UserActivationTokenEntity>;

export type UserActivationTokenDataUpdate =
  EntityDataUpdate<UserActivationTokenEntity>;

export type UserActivationTokenDataUpdated =
  EntityDataUpdated<UserActivationTokenEntity>;

export class UserActivationTokenEntity extends Entity {
  defineUserId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
      readonly: true,
    });
  }

  defineToken() {
    return this.createField({
      schema: z.string().min(64),
      readonly: true,
    });
  }

  defineExpiresAt() {
    const fifteenMinutesInMilliseconds = 1000 * 60 * 15;

    return this.createField({
      schema: z.date(),
      readonly: true,
      static: true,
      default: new Date(Date.now() + fifteenMinutesInMilliseconds),
    });
  }

  public static get create() {
    const userActivationToken = new this();

    return userActivationToken.createEntity.bind(userActivationToken);
  }

  public static get baseSchema() {
    return new this().baseSchema;
  }
}
