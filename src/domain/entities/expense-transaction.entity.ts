import { EntityDefinition } from "@/core/@types/entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { TransactionEntity } from "./transaction.entity";

export abstract class ExpenseTransactionEntity
  extends TransactionEntity
  implements EntityDefinition<ExpenseTransactionEntity>
{
  defineCategoryId() {
    return {
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    };
  }
}
