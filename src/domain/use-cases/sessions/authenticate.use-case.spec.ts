import { ValidationError } from "@/core/errors/errors";
import { ForbiddenActionError, InvalidCredentialsError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { FakeEncryption } from "test/gateways/cryptology/fake-encryption";
import { FakePasswordHasher } from "test/gateways/cryptology/fake-password-hasher";
import { FakeEmailDispatcher } from "test/gateways/fake-email-dispatcher";
import { InMemoryAccountActivationTokenRepository } from "test/repositories/in-memory-account-activation-token.repository";
import { InMemorySessionRepository } from "test/repositories/in-memory-session.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthenticateUseCase } from "../sessions/authenticate.use-case";
import { RequestUserAccountActivationUseCase } from "../user/request-user-account-activation.use-case";

let userRepository: InMemoryUserRepository;
let passwordHasher: FakePasswordHasher;
let encryption: FakeEncryption;
let accountActivationTokenRepository: InMemoryAccountActivationTokenRepository;
let emailDispatcher: FakeEmailDispatcher;
let requestAccountActivationUseCase: RequestUserAccountActivationUseCase;
let sessionRepository: InMemorySessionRepository;

let sut: AuthenticateUseCase;

let user: ReturnType<typeof makeUser>;

describe("[Use Case] Authenticate user", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    passwordHasher = new FakePasswordHasher();
    encryption = new FakeEncryption();
    userRepository = new InMemoryUserRepository();
    accountActivationTokenRepository =
      new InMemoryAccountActivationTokenRepository({ userRepository });
    emailDispatcher = new FakeEmailDispatcher();
    requestAccountActivationUseCase = new RequestUserAccountActivationUseCase({
      accountActivationTokenRepository,
      emailDispatcher,
      encryption,
    });
    sessionRepository = new InMemorySessionRepository();

    sut = new AuthenticateUseCase({
      userRepository,
      passwordHasher,
      encryption,
      requestAccountActivationUseCase,
      sessionRepository,
    });

    user = makeUser();

    await userRepository.create(user.entity);

    user.entity.update({
      password: await passwordHasher.hash(user.input.password),
    });
  });

  it("should be able to authenticate a user", async () => {
    const { isRight, result } = await sut.execute<"success">(user.input);

    expect(isRight()).toBeTruthy();
    expect(result.user).not.toHaveProperty("password");
    expect(result.user.email).toEqual(user.input.email);
    expect(result.token).toEqual(sessionRepository.items[0].token);
    expect(userRepository.items[0]).toMatchObject(result.user);
    expect(sessionRepository.items[0].userId.value).toEqual(
      user.entity.id.value,
    );
    expect(sessionRepository.items[0].expiresAt.getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("should not be able to authenticate a user with a non-existent email", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...user.input,
      email: faker.internet.email(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to authenticate a user with invalid password", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...user.input,
      password: faker.internet.password(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(InvalidCredentialsError);
  });

  it("should not be able to authenticate a user that was not activated", async () => {
    userRepository.items[0].update({ activatedAt: null });

    const { isLeft, reason } = await sut.execute<"error">(user.input);

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ForbiddenActionError);
    expect(emailDispatcher.inbox).toHaveLength(1);
    expect(emailDispatcher.inbox[0].recipientId).toEqual(user.entity.id.value);
    expect(emailDispatcher.inbox[0].content).toEqual(
      accountActivationTokenRepository.items[0].token,
    );
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
