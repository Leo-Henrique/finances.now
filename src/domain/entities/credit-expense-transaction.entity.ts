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

export type CreditExpenseTransaction =
  EntityInstance<CreditExpenseTransactionEntity>;

export type CreditExpenseTransactionData =
  EntityData<CreditExpenseTransactionEntity>;

export type CreditExpenseTransactionDataCreate =
  EntityDataCreate<CreditExpenseTransactionEntity>;

export type CreditExpenseTransactionDataUpdate =
  EntityDataUpdate<CreditExpenseTransactionEntity>;

export type CreditExpenseTransactionDataUpdated =
  EntityDataUpdated<CreditExpenseTransactionEntity>;

export class CreditExpenseTransactionEntity
  extends ExpenseTransactionEntity
  implements EntityDefinition<CreditExpenseTransactionEntity>
{
  defineCreditCardId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  public static create(input: CreditExpenseTransactionDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
