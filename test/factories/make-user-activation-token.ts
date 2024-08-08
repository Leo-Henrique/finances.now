import {
  UserActivationTokenDataCreate,
  UserActivationTokenEntity,
} from "@/domain/entities/user-activation-token.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeUserActivationTokenInput = SetRequired<
  Partial<UserActivationTokenDataCreate>,
  "userId"
>;

export function makeUserActivationToken({
  userId,
  ...override
}: MakeUserActivationTokenInput) {
  const input = {
    userId,
    token: faker.string.alphanumeric({ length: { min: 64, max: 512 } }),
    ...override,
  } satisfies UserActivationTokenDataCreate;
  const entity = UserActivationTokenEntity.create(input);

  return { input, entity };
}
