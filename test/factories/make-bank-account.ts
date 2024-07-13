import {
  BankAccountDataCreate,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeBankAccountInput = SetRequired<
  Partial<BankAccountDataCreate>,
  "userId"
>;

export function makeBankAccount({ userId, ...override }: MakeBankAccountInput) {
  const input = {
    userId,
    institution: faker.company.name(),
    description: faker.string.alphanumeric({ length: { min: 1, max: 255 } }),
    balance: faker.number.int(100),
    mainAccount: faker.datatype.boolean(),
    ...override,
  } satisfies BankAccountDataCreate;
  const entity = BankAccountEntity.create(input);

  return { input, entity };
}
