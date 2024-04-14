import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { UpdateUserUseCase } from "./update-user.use-case";

let userRepository: InMemoryUserRepository;
let sut: UpdateUserUseCase;
let user: ReturnType<typeof makeUser>;

describe("[Use Case] Update user", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    sut = new UpdateUserUseCase({ userRepository });
    user = makeUser();

    await userRepository.create(user.entity);
  });

  it("should be able to update an user", async () => {
    const updatedName = faker.person.fullName();
    const { isRight, result } = await sut.execute<"success">({
      userId: user.entity.id.value,
      data: { name: updatedName },
    });

    expect(isRight()).toBeTruthy();
    expect(result.user.id.value).toEqual(user.entity.id.value);
    expect(result.user.name).toEqual(updatedName);
    expect(userRepository.items[0].name).toEqual(updatedName);
  });

  it("should not be able to update an non-existent user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      data: { name: faker.person.fullName() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update an user without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: fields is required
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update an user with invalid name", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId: user.entity.id.value,
        data: {
          name: faker.string.alphanumeric({ length: { min: 255, max: 300 } }),
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
