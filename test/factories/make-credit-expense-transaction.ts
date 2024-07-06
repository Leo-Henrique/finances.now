import {
  CreditExpenseTransactionDataCreate,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeCreditExpenseTransactionInput = SetRequired<
  Partial<CreditExpenseTransactionDataCreate>,
  "creditCardId" | "categoryId"
>;

export function makeCreditExpenseTransaction({
  creditCardId,
  categoryId,
  ...override
}: MakeCreditExpenseTransactionInput) {
  const input: CreditExpenseTransactionDataCreate = {
    creditCardId,
    categoryId,
    transactedAt: faker.date.recent(),
    amount: faker.number.float({ min: 1, fractionDigits: 2 }),
    description: faker.lorem.sentences().substring(1, 255),
    ...override,
  };
  const entity = CreditExpenseTransactionEntity.create(input);

  return { input, entity };
}
