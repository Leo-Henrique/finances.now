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

export type AccountActivationToken =
  EntityInstance<AccountActivationTokenEntity>;

export type AccountActivationTokenData =
  EntityData<AccountActivationTokenEntity>;

export type AccountActivationTokenDataCreate =
  EntityDataCreate<AccountActivationTokenEntity>;

export type AccountActivationTokenDataUpdate =
  EntityDataUpdate<AccountActivationTokenEntity>;

export type AccountActivationTokenDataUpdated =
  EntityDataUpdated<AccountActivationTokenEntity>;

export class AccountActivationTokenEntity extends Entity {
  defineUserId() {
    return this.createField({
      schema: z.instanceof(UniqueEntityId),
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

  public static create(input: AccountActivationTokenDataCreate) {
    return new this().createEntity(input);
  }

  public static get baseSchema() {
    return new this().baseSchema;
  }
}
