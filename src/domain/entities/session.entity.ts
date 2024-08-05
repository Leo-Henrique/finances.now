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

export type Session = EntityInstance<SessionEntity>;

export type SessionData = EntityData<SessionEntity>;

export type SessionDataCreate = EntityDataCreate<SessionEntity>;

export type SessionDataUpdate = EntityDataUpdate<SessionEntity>;

export type SessionDataUpdated = EntityDataUpdated<SessionEntity>;

export const SESSION_DURATION_IN_MILLISECONDS = 1000 * 60 * 60 * 24 * 3; // 3 days

export class SessionEntity extends Entity {
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
    return this.createField({
      schema: z.date(),
      static: true,
      default: new Date(Date.now() + SESSION_DURATION_IN_MILLISECONDS),
    });
  }

  defineUpdatedAt() {
    return this.createField({
      schema: z.date().nullable(),
      default: null,
      static: true,
      readonly: true,
    });
  }

  defineCreatedAt() {
    return this.createField({
      schema: z.date(),
      default: new Date(),
      static: true,
      readonly: true,
    });
  }

  public static create(input: SessionDataCreate) {
    return new this().createEntity(input);
  }

  public static get baseSchema() {
    return new this().baseSchema;
  }
}
