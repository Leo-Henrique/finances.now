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
  const input: EarningTransactionDataCreate = {
    bankAccountId,
    categoryId,
    transactedAt: faker.date.recent(),
    amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
    description: faker.lorem.sentences().substring(1, 255),
    ...override,
  };
  const entity = EarningTransactionEntity.create(input);

  return { input, entity };
}
