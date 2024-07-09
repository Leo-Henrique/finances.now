import {
  DebitExpenseTransactionDataCreate,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeDebitExpenseTransactionInput = SetRequired<
  Partial<DebitExpenseTransactionDataCreate>,
  "bankAccountId" | "categoryId"
>;

export function makeDebitExpenseTransaction({
  bankAccountId,
  categoryId,
  ...override
}: MakeDebitExpenseTransactionInput) {
  const input: DebitExpenseTransactionDataCreate = {
    bankAccountId,
    categoryId,
    transactedAt: faker.date.recent(),
    amount: faker.number.float({ min: 1, fractionDigits: 2 }),
    description: faker.lorem.sentences().substring(1, 255),
    ...override,
  };
  const entity = DebitExpenseTransactionEntity.create(input);

  return { input, entity };
}