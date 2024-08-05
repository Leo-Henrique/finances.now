import {
  AccountActivationTokenDataCreate,
  AccountActivationTokenEntity,
} from "@/domain/entities/account-activation-token.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeAccountActivationTokenInput = SetRequired<
  Partial<AccountActivationTokenDataCreate>,
  "userId"
>;

export function makeAccountActivationToken({
  userId,
  ...override
}: MakeAccountActivationTokenInput) {
  const input = {
    userId,
    token: faker.string.alphanumeric({ length: { min: 64, max: 512 } }),
    ...override,
  } satisfies AccountActivationTokenDataCreate;
  const entity = AccountActivationTokenEntity.create(input);

  return { input, entity };
}
