import { UserDataCreate, UserEntity } from "@/domain/entities/user.entity";
import { faker } from "@faker-js/faker";

type MakeUserInput = Partial<UserDataCreate>;

export function makeUser(override: MakeUserInput = {}) {
  const input: UserDataCreate = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    ...override,
  };
  const entity = UserEntity.create(input);

  return { input, entity };
}
