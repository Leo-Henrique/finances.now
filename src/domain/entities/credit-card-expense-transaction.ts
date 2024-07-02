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

export type CreditCardExpenseTransaction =
  EntityInstance<CreditCardExpenseTransactionEntity>;

export type CreditCardExpenseTransactionData =
  EntityData<CreditCardExpenseTransactionEntity>;

export type CreditCardExpenseTransactionDataCreate =
  EntityDataCreate<CreditCardExpenseTransactionEntity>;

export type CreditCardExpenseTransactionDataUpdate =
  EntityDataUpdate<CreditCardExpenseTransactionEntity>;

export type CreditCardExpenseTransactionDataUpdated =
  EntityDataUpdated<CreditCardExpenseTransactionEntity>;

export class CreditCardExpenseTransactionEntity
  extends ExpenseTransactionEntity
  implements EntityDefinition<CreditCardExpenseTransactionEntity>
{
  defineCreditCardId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }

  public static create(input: CreditCardExpenseTransactionDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}
