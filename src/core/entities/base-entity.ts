import { z } from "zod";
import { Entity } from "./entity";
import { UniqueEntityId } from "./unique-entity-id";

export abstract class BaseEntity extends Entity {
  defineId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      default: new UniqueEntityId().value,
      transform: (val: string) => new UniqueEntityId(val),
      static: true,
      readonly: true,
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
}
