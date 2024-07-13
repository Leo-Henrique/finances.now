import {
  TransferenceTransactionDataCreate,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeTransferenceTransactionInput = SetRequired<
  Partial<TransferenceTransactionDataCreate>,
  "originBankAccountId" | "destinyBankAccountId"
>;

export function makeTransferenceTransaction({
  originBankAccountId,
  destinyBankAccountId,
  ...override
}: MakeTransferenceTransactionInput) {
  const input = {
    originBankAccountId,
    destinyBankAccountId,
    amount: faker.number.float({ min: 1, fractionDigits: 2 }),
    description: faker.lorem.sentences().substring(1, 255),
    transactedAt: faker.date.recent(),
    ...override,
  } satisfies TransferenceTransactionDataCreate;
  const entity = TransferenceTransactionEntity.create(input);

  return { input, entity };
}
