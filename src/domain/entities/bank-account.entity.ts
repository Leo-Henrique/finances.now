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

export type BankAccount = EntityInstance<BankAccountEntity>;

export type BankAccountData = EntityData<BankAccountEntity>;

export type BankAccountDataCreate = EntityDataCreate<BankAccountEntity>;

export type BankAccountDataUpdate = EntityDataUpdate<BankAccountEntity>;

export type BankAccountDataUpdated = EntityDataUpdated<BankAccountEntity>;

export class BankAccountEntity
  extends BaseEntity
  implements EntityDefinition<BankAccountEntity>
{
  defineUserId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
      readonly: true,
    };
  }

  defineSlug() {
    return {
      schema: Slug.schema,
      transform: (val: string) => new Slug(val),
      static: true,
    };
  }

  defineInstitution() {
    return {
      schema: Name.schema,
      transform: (val: string) => new Name(val),
      onDefinition: () => {
        const { institution } = this.getData<BankAccountEntity>();

        this.earlyUpdate<BankAccountEntity>({ slug: institution.value });
      },
    };
  }

  defineDescription() {
    return {
      schema: z.string().max(255).trim().nullable(),
      default: null,
    };
  }

  defineBalance() {
    return {
      schema: z.union([z.number().positive(), z.literal(0)]),
      default: 0,
    };
  }

  defineMainAccount() {
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

  public static create(input: BankAccountDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
