import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityDefinition,
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

export class EarningTransactionEntity
  extends TransactionEntity
  implements EntityDefinition<EarningTransactionEntity>
{
  defineCategoryId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  defineBankAccountId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
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
