import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityDefinition,
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

export class CreditCardEntity
  extends BaseEntity
  implements EntityDefinition<CreditCardEntity>
{
  defineBankAccountId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  defineSlug() {
    return {
      schema: Slug.schema,
      transform: (val: string) => new Slug(val),
      static: true,
    };
  }

  defineName() {
    return {
      schema: Name.schema,
      transform: (val: string) => new Name(val),
      onDefinition: () => {
        const { name } = this.getData<CreditCardEntity>();

        this.earlyUpdate<CreditCardEntity>({ slug: name.value });
      },
    };
  }

  defineDescription() {
    return {
      schema: z.string().max(255).trim().nullable(),
      default: null,
    };
  }

  defineLimit() {
    return {
      schema: z.number().positive(),
    };
  }

  defineInvoiceClosingDay() {
    return {
      schema: z.number().positive().int().max(31),
    };
  }

  defineInvoiceDueDay() {
    return {
      schema: z.number().positive().int().max(31),
    };
  }

  defineMainCard() {
    return {
      schema: z.boolean(),
      default: false,
    };
  }

  defineInactivatedAt() {
    return {
      schema: z.date().nullable(),
      default: null,
      static: true,
    };
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
