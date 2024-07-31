import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { Password } from "@/domain/entities/value-objects/password";
import { ResourceAlreadyExistsError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { FakePasswordHasher } from "test/gateways/fake-password-hasher";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { RegisterUserUseCase } from "./register-user.use-case";

let userRepository: InMemoryUserRepository;
let passwordHasher: FakePasswordHasher;
let sut: RegisterUserUseCase;
let user: ReturnType<typeof makeUser>;

describe("[Use Case] Register user", () => {
  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    sut = new RegisterUserUseCase({ userRepository, passwordHasher });
    user = makeUser();
  });

  it("should be able to register a user", async () => {
    const { isRight, result } = await sut.execute<"success">(user.input);

    expect(isRight()).toBeTruthy();
    expect(result.user.id).toBeInstanceOf(UniqueEntityId);
    expect(result.user.email).toEqual(user.input.email);
    expect(userRepository.items[0]).toMatchObject(result.user);
  });

  it("should be able to create a user with hashed password and not return it", async () => {
    const { isRight, result } = await sut.execute<"success">(user.input);
    const isValidPassword = await passwordHasher.match(
      user.input.password,
      userRepository.items[0].password.value,
    );

    expect(isRight()).toBeTruthy();
    expect(isValidPassword).toBeTruthy();
    expect(result.user).not.toHaveProperty("password");
    expect(userRepository.items[0].password).toBeInstanceOf(Password);
  });

  it("should not be able to register a user with an existing email", async () => {
    await userRepository.create(user.entity);

    const { isLeft, reason } = await sut.execute<"error">(user.input);

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceAlreadyExistsError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to register a user with invalid name", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...user.input,
        name: faker.string.alphanumeric({ length: { min: 255, max: 300 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to register a user with invalid email", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...user.input,
        email: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to register a user with invalid password", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...user.input,
        password: faker.string.alphanumeric({ length: { min: 0, max: 5 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
