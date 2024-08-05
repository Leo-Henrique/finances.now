import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { Password } from "@/domain/entities/value-objects/password";
import { ResourceAlreadyExistsError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { FakeEncryption } from "test/gateways/auth/fake-encryption";
import { FakePasswordHasher } from "test/gateways/auth/fake-password-hasher";
import { FakeEmailDispatcher } from "test/gateways/fake-email-dispatcher";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryAccountActivationTokenRepository } from "test/repositories/in-memory-account-activation-token.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { RegisterUserUseCase } from "./register-user.use-case";
import { RequestAccountActivationUseCase } from "./request-account-activation.use-case";

let userRepository: InMemoryUserRepository;
let passwordHasher: FakePasswordHasher;
let unitOfWork: FakeUnitOfWork;
let accountActivationTokenRepository: InMemoryAccountActivationTokenRepository;
let encryption: FakeEncryption;
let emailDispatcher: FakeEmailDispatcher;
let requestAccountActivationUseCase: RequestAccountActivationUseCase;

let sut: RegisterUserUseCase;

let user: ReturnType<typeof makeUser>;

describe("[Use Case] Register user", () => {
  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    unitOfWork = new FakeUnitOfWork();
    accountActivationTokenRepository =
      new InMemoryAccountActivationTokenRepository({ userRepository });
    encryption = new FakeEncryption();
    emailDispatcher = new FakeEmailDispatcher();
    requestAccountActivationUseCase = new RequestAccountActivationUseCase({
      accountActivationTokenRepository,
      encryption,
      emailDispatcher,
    });

    sut = new RegisterUserUseCase({
      userRepository,
      passwordHasher,
      unitOfWork,
      requestAccountActivationUseCase,
    });

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
