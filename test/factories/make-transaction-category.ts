import {
  TransactionCategoryDataCreate,
  TransactionCategoryEntity,
} from "@/domain/entities/transaction-category.entity";
import { faker } from "@faker-js/faker";

type MakeTransactionCategoryInput = Partial<TransactionCategoryDataCreate>;

export function makeTransactionCategory({
  ...override
}: MakeTransactionCategoryInput = {}) {
  const input: TransactionCategoryDataCreate = {
    userId: null,
    name: faker.lorem.word(),
    isInExpense: faker.datatype.boolean(),
    ...override,
  };
  const entity = TransactionCategoryEntity.create(input);

  return { input, entity };
}
