import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityInstance,
} from "@/core/@types/entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { TransactionEntity } from "./transaction.entity";

export type EarningTransaction = EntityInstance<EarningTransactionEntity>;

export type EarningTransactionData = EntityData<EarningTransactionEntity>;

export type EarningTransactionDataCreate =
  EntityDataCreate<EarningTransactionEntity>;

export type EarningTransactionDataUpdate =
  EntityDataUpdate<EarningTransactionEntity>;

export type EarningTransactionDataUpdated =
  EntityDataUpdated<EarningTransactionEntity>;

export class EarningTransactionEntity extends TransactionEntity {
  defineCategoryId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    });
  }

  defineBankAccountId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    });
  }

  public static create(input: EarningTransactionDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
