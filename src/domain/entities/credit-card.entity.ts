import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityInstance,
} from "@/core/@types/entity";
import { BaseEntity } from "@/core/entities/base-entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { z } from "zod";
import { Name } from "./value-objects/name";
import { Slug } from "./value-objects/slug";

export type CreditCard = EntityInstance<CreditCardEntity>;

export type CreditCardData = EntityData<CreditCardEntity>;

export type CreditCardDataCreate = EntityDataCreate<CreditCardEntity>;

export type CreditCardDataUpdate = EntityDataUpdate<CreditCardEntity>;

export type CreditCardDataUpdated = EntityDataUpdated<CreditCardEntity>;

export class CreditCardEntity extends BaseEntity {
  defineBankAccountId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    });
  }

  defineSlug() {
    return this.createField({
      schema: Slug.schema,
      transform: (val: string) => new Slug(val),
      static: true,
    });
  }

  defineName() {
    return this.createField({
      schema: Name.schema,
      transform: (val: string) => new Name(val),
      onDefinition: () => {
        const { name } = this.getData<CreditCardEntity>();

        this.earlyUpdate<CreditCardEntity>({ slug: name.value });
      },
    });
  }

  defineDescription() {
    return this.createField({
      schema: z.string().max(255).trim().nullable(),
      default: null,
    });
  }

  defineLimit() {
    return this.createField({
      schema: z.number().positive(),
    });
  }

  defineInvoiceClosingDay() {
    return this.createField({
      schema: z.number().positive().int().max(31),
    });
  }

  defineInvoiceDueDay() {
    return this.createField({
      schema: z.number().positive().int().max(31),
    });
  }

  defineMainCard() {
    return this.createField({
      schema: z.boolean(),
      default: false,
    });
  }

  defineInactivatedAt() {
    return this.createField({
      schema: z.date().nullable(),
      default: null,
      static: true,
    });
  }

  public static create(input: CreditCardDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
