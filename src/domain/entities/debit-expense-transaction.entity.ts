import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityDefinition,
  EntityInstance,
} from "@/core/@types/entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ExpenseTransactionEntity } from "./expense-transaction.entity";

export type DebitExpenseTransaction =
  EntityInstance<DebitExpenseTransactionEntity>;

export type DebitExpenseTransactionData =
  EntityData<DebitExpenseTransactionEntity>;

export type DebitExpenseTransactionDataCreate =
  EntityDataCreate<DebitExpenseTransactionEntity>;

export type DebitExpenseTransactionDataUpdate =
  EntityDataUpdate<DebitExpenseTransactionEntity>;

export type DebitExpenseTransactionDataUpdated =
  EntityDataUpdated<DebitExpenseTransactionEntity>;

export class DebitExpenseTransactionEntity
  extends ExpenseTransactionEntity
  implements EntityDefinition<DebitExpenseTransactionEntity>
{
  defineBankAccountId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  public static create(input: DebitExpenseTransactionDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
