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

export type TransferenceTransaction =
  EntityInstance<TransferenceTransactionEntity>;

export type TransferenceTransactionData =
  EntityData<TransferenceTransactionEntity>;

export type TransferenceTransactionDataCreate =
  EntityDataCreate<TransferenceTransactionEntity>;

export type TransferenceTransactionDataUpdate =
  EntityDataUpdate<TransferenceTransactionEntity>;

export type TransferenceTransactionDataUpdated =
  EntityDataUpdated<TransferenceTransactionEntity>;

export class TransferenceTransactionEntity
  extends TransactionEntity
  implements EntityDefinition<TransferenceTransactionEntity>
{
  defineOriginBankAccountId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  defineDestinyBankAccountId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  public static create(input: TransferenceTransactionDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
