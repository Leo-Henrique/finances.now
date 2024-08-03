import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { TransactionEntity } from "./transaction.entity";

export abstract class ExpenseTransactionEntity extends TransactionEntity {
  defineCategoryId() {
    return this.createField({
      schema: UniqueEntityId.schema,
      transform: (val: string) => new UniqueEntityId(val),
    });
  }
}
