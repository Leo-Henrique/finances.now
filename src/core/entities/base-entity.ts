import { z } from "zod";
import { EntityDefinition } from "../@types/entity";
import { Entity } from "./entity";
import { UniqueEntityId } from "./unique-entity-id";

export abstract class BaseEntity
  extends Entity
  implements EntityDefinition<BaseEntity>
{
  defineId() {
    return {
      schema: z.instanceof(UniqueEntityId),
      default: new UniqueEntityId(),
      static: true,
      readonly: true,
    };
  }

  defineUpdatedAt() {
    return {
      schema: z.date().nullable(),
      default: null,
      static: true,
      readonly: true,
    };
  }

  defineCreatedAt() {
    return {
      schema: z.date(),
      default: new Date(),
      static: true,
      readonly: true,
    };
  }
}
