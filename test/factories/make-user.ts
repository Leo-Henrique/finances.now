import { UserDataCreate, UserEntity } from "@/domain/entities/user.entity";
import { faker } from "@faker-js/faker";

export function makeUser(override: Partial<UserDataCreate> = {}) {
  const input: UserDataCreate = {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password(),
    ...override,
  };
  const entity = UserEntity.create(input);

  return { input, entity };
}
