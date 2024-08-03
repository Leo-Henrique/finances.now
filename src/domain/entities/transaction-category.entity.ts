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
import { Name } from "./value-objects/name";

export type TransactionCategory = EntityInstance<TransactionCategoryEntity>;

export type TransactionCategoryData = EntityData<TransactionCategoryEntity>;

export type TransactionCategoryDataCreate =
  EntityDataCreate<TransactionCategoryEntity>;

export type TransactionCategoryDataUpdate =
  EntityDataUpdate<TransactionCategoryEntity>;

export type TransactionCategoryDataUpdated =
  EntityDataUpdated<TransactionCategoryEntity>;

export class TransactionCategoryEntity extends Entity {
  defineId() {
    return this.createField({
      schema: z.instanceof(UniqueEntityId),
      default: new UniqueEntityId(),
      static: true,
      readonly: true,
    });
  }

  defineUserId() {
    return this.createField({
      schema: UniqueEntityId.schema.nullable(),
      default: null,
      transform: (val: string | null) => {
        if (val) return new UniqueEntityId(val);

        return null;
      },
    });
  }

  defineIsInExpense() {
    return this.createField({
      schema: z.boolean(),
      readonly: true,
    });
  }

  defineName() {
    return this.createField({
      schema: Name.schema,
      transform: (val: string) => new Name(val),
    });
  }

  get isDefault() {
    const data = this.getData<TransactionCategoryEntity>();

    return !!data.userId;
  }

  public static create(input: TransactionCategoryDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
