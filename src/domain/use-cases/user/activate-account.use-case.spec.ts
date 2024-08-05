import { ValidationError } from "@/core/errors/errors";
import {
  AccountActivationTokenExpiredError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeAccountActivationToken } from "test/factories/make-account-activation-token";
import { makeUser } from "test/factories/make-user";
import { InMemoryAccountActivationTokenRepository } from "test/repositories/in-memory-account-activation-token.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivateAccountUseCase } from "./activate-account.use-case";

let userRepository: InMemoryUserRepository;
let accountActivationTokenRepository: InMemoryAccountActivationTokenRepository;

let sut: ActivateAccountUseCase;

let user: ReturnType<typeof makeUser>;
let accountActivationToken: ReturnType<typeof makeAccountActivationToken>;

describe("[Use Case] Activate account", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    accountActivationTokenRepository =
      new InMemoryAccountActivationTokenRepository({ userRepository });

    sut = new ActivateAccountUseCase({ accountActivationTokenRepository });

    user = makeUser();
    accountActivationToken = makeAccountActivationToken({
      userId: user.entity.id,
    });

    await userRepository.create(user.entity);
    await accountActivationTokenRepository.create(
      accountActivationToken.entity,
    );
  });

  it("should be able to activate account", async () => {
    const { isRight } = await sut.execute<"success">({
      userId: user.entity.id.value,
      token: accountActivationToken.entity.token,
    });

    expect(isRight()).toBeTruthy();
    expect(accountActivationTokenRepository.items).toHaveLength(0);
    expect(userRepository.items[0].activatedAt).toEqual(expect.any(Date));
  });

  it("should not be able to activate a non-existent account activation token", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: user.entity.id.value,
      token: faker.string.alphanumeric(64),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to activate account that does not belong to the user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      token: accountActivationToken.entity.token,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to activate account if token is expired", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const oneMinuteInMilliseconds = 1000 * 60;

    vi.advanceTimersByTime(oneMinuteInMilliseconds * 10);

    const validTokenResult = await sut.execute<"success">({
      userId: accountActivationToken.entity.userId.value,
      token: accountActivationToken.entity.token,
    });

    expect(validTokenResult.isRight()).toBeTruthy();

    await accountActivationTokenRepository.create(
      accountActivationToken.entity,
    );

    vi.advanceTimersByTime(oneMinuteInMilliseconds * 15);

    const invalidTokenResult = await sut.execute<"error">({
      userId: accountActivationToken.entity.userId.value,
      token: accountActivationToken.entity.token,
    });

    expect(invalidTokenResult.isLeft()).toBeTruthy();
    expect(invalidTokenResult.reason).toBeInstanceOf(
      AccountActivationTokenExpiredError,
    );

    vi.useRealTimers();
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to activate account without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        token: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to activate account with invalid token", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId: accountActivationToken.entity.userId.value,
        token: faker.string.alphanumeric({ length: { min: 0, max: 63 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
