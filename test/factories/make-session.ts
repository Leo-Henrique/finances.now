import {
  SessionDataCreate,
  SessionEntity,
} from "@/domain/entities/session.entity";
import { faker } from "@faker-js/faker";
import { SetRequired } from "type-fest";

type MakeSessionInput = SetRequired<Partial<SessionDataCreate>, "userId">;

export function makeSession({ userId, ...override }: MakeSessionInput) {
  const input = {
    userId,
    token: faker.string.alphanumeric({ length: { min: 64, max: 512 } }),
    ...override,
  } satisfies SessionDataCreate;
  const entity = SessionEntity.create(input);

  return { input, entity };
}
