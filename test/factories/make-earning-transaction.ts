import {
  EarningTransactionDataCreate,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeEarningTransactionInput = SetRequired<
  Partial<EarningTransactionDataCreate>,
  "bankAccountId" | "categoryId"
>;

export function makeEarningTransaction({
  bankAccountId,
  categoryId,
  ...override
}: MakeEarningTransactionInput) {
  const input = {
    bankAccountId,
    categoryId,
    transactedAt: faker.date.recent(),
    amount: +faker.finance.amount({ dec: 0 }),
    description: faker.lorem.sentences().substring(1, 255),
    ...override,
  } satisfies EarningTransactionDataCreate;
  const entity = EarningTransactionEntity.create(input);

  return { input, entity };
}
