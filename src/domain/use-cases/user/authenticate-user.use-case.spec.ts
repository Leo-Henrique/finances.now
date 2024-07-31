import { ValidationError } from "@/core/errors/errors";
import { InvalidCredentialsError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { FakePasswordHasher } from "test/gateways/fake-password-hasher";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthenticateUserUseCase } from "./authenticate-user.use-case";

let userRepository: InMemoryUserRepository;
let passwordHasher: FakePasswordHasher;
let sut: AuthenticateUserUseCase;
let user: ReturnType<typeof makeUser>;

describe("[Use Case] Authenticate user", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    sut = new AuthenticateUserUseCase({ userRepository, passwordHasher });
    user = makeUser();

    await userRepository.create(user.entity);

    user.entity.update({
      password: await passwordHasher.hash(user.input.password),
    });
  });

  it("should be able to authenticate a user", async () => {
    const { isRight, result } = await sut.execute<"success">(user.input);

    expect(isRight()).toBeTruthy();
    expect(result.user.email).toEqual(user.input.email);
    expect(result.user).not.toHaveProperty("password");
    expect(userRepository.items[0]).toMatchObject(result.user);
  });

  it("should not be able to register a user with a nonexistent email", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...user.input,
      email: faker.internet.email(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to register a user with invalid password", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...user.input,
      password: faker.internet.password(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(InvalidCredentialsError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to authenticate a user with invalid email", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...user.input,
        email: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to authenticate a user with invalid password", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...user.input,
        password: faker.string.alphanumeric({ length: { min: 0, max: 5 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
