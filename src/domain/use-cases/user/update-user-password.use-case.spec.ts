import { ValidationError } from "@/core/errors/errors";
import {
  NewPasswordSameAsCurrentError,
  ResourceNotFoundError,
  UnauthorizedError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { FakePasswordHasher } from "test/gateways/cryptology/fake-password-hasher";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { UpdateUserPasswordUseCase } from "./update-user-password.use-case";

let userRepository: InMemoryUserRepository;
let passwordHasher: FakePasswordHasher;
let sut: UpdateUserPasswordUseCase;
let user: ReturnType<typeof makeUser>;

const currentPassword = "123456";

describe("[Use Case] Update user password", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    sut = new UpdateUserPasswordUseCase({ userRepository, passwordHasher });
    user = makeUser({ password: currentPassword });

    await userRepository.create(user.entity);

    user.entity.update({
      password: await passwordHasher.hash(user.input.password),
    });
  });

  it("should be able to update a user password", async () => {
    const updatedPassword = faker.internet.password();
    const { isRight, result } = await sut.execute<"success">({
      userId: user.entity.id.value,
      currentPassword,
      newPassword: updatedPassword,
    });

    const isValidUpdatedPassword = await passwordHasher.match(
      updatedPassword,
      userRepository.items[0].password.value,
    );

    expect(isRight()).toBeTruthy();
    expect(result.user.id.value).toEqual(user.entity.id.value);
    expect(isValidUpdatedPassword).toBeTruthy();
  });

  it("should not be able to update password a non-existent user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      currentPassword,
      newPassword: faker.internet.password(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update password by providing an invalid current password", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: user.entity.id.value,
      currentPassword: faker.internet.password(),
      newPassword: faker.internet.password(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to update password by providing the same current password", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: user.entity.id.value,
      currentPassword,
      newPassword: currentPassword,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(NewPasswordSameAsCurrentError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update an user password without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        currentPassword: undefined,
        // @ts-expect-error: field is required
        newPassword: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update an user password with invalid new password", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId: faker.string.uuid(),
        currentPassword,
        newPassword: faker.string.alphanumeric({ length: { min: 0, max: 5 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
