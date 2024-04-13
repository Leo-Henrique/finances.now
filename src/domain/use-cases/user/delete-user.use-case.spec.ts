import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { DeleteUserUseCase } from "./delete-user.use-case";

let userRepository: InMemoryUserRepository;
let sut: DeleteUserUseCase;
let user: ReturnType<typeof makeUser>;

const currentPassword = "123456";

describe("[Use Case] Delete user", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    sut = new DeleteUserUseCase({ userRepository });
    user = makeUser({ password: currentPassword });

    await userRepository.create(user.entity);
  });

  it("should be able to delete an user", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId: user.entity.id.value,
      currentPassword,
    });

    expect(isRight()).toBeTruthy();
    expect(result).toEqual({});
    expect(userRepository.items).toHaveLength(0);
  });

  it("should not be able to delete an non-existent user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      currentPassword,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete user by providing an invalid current password", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: user.entity.id.value,
      currentPassword: faker.internet.password(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to delete an user with invalid password", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId: faker.string.uuid(),
        currentPassword: faker.string.alphanumeric({
          length: { min: 0, max: 5 },
        }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
