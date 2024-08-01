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
    amount: +faker.finance.amount({ dec: 0 }),
    description: faker.lorem.sentences().substring(1, 255),
    ...override,
  } satisfies DebitExpenseTransactionDataCreate;
  const entity = DebitExpenseTransactionEntity.create(input);

  return { input, entity };
}
