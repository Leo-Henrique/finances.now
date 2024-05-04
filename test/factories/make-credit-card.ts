import {
  CreditCardDataCreate,
  CreditCardEntity,
} from "@/domain/entities/credit-card.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeCreditCardInput = SetRequired<
  Partial<CreditCardDataCreate>,
  "userId" | "bankAccountId"
>;

export function makeCreditCard({
  userId,
  bankAccountId,
  ...override
}: MakeCreditCardInput) {
  const input: CreditCardDataCreate = {
    userId,
    bankAccountId,
    name: faker.lorem.sentence(),
    description: faker.string.alphanumeric({ length: { min: 1, max: 255 } }),
    limit: faker.number.int({ min: 1 }),
    invoiceClosingDay: faker.number.int({ min: 1, max: 31 }),
    invoiceDueDay: faker.number.int({ min: 1, max: 31 }),
    mainCard: faker.datatype.boolean(),
    ...override,
  };
  const entity = CreditCardEntity.create(input);

  return { input, entity };
}
