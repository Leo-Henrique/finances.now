import {
  CreditCardDataCreate,
  CreditCardEntity,
} from "@/domain/entities/credit-card.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeCreditCardInput = SetRequired<
  Partial<CreditCardDataCreate>,
  "bankAccountId"
>;

export function makeCreditCard({
  bankAccountId,
  ...override
}: MakeCreditCardInput) {
  const input = {
    bankAccountId,
    name: faker.lorem.sentence(),
    description: faker.string.alphanumeric({ length: { min: 1, max: 255 } }),
    limit: faker.number.int({ min: 1 }),
    invoiceClosingDay: faker.number.int({ min: 1, max: 31 }),
    invoiceDueDay: faker.number.int({ min: 1, max: 31 }),
    mainCard: faker.datatype.boolean(),
    ...override,
  } satisfies CreditCardDataCreate;
  const entity = CreditCardEntity.create(input);

  return { input, entity };
}
