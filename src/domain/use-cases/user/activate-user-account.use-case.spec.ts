import { ValidationError } from "@/core/errors/errors";
import {
  ResourceNotFoundError,
  UserActivationTokenExpiredError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUserActivationToken } from "test/factories/make-account-activation-token";
import { makeUser } from "test/factories/make-user";

import { InMemoryUserActivationTokenRepository } from "test/repositories/in-memory-user-activation-token.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivateUserAccountUseCase } from "./activate-user-account.use-case";

let userRepository: InMemoryUserRepository;
let userActivationTokenRepository: InMemoryUserActivationTokenRepository;

let sut: ActivateUserAccountUseCase;

let user: ReturnType<typeof makeUser>;
let accountActivationToken: ReturnType<typeof makeUserActivationToken>;

describe("[Use Case] Activate user account", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    userActivationTokenRepository = new InMemoryUserActivationTokenRepository({
      userRepository,
    });

    sut = new ActivateUserAccountUseCase({
      userActivationTokenRepository: userActivationTokenRepository,
    });

    user = makeUser();
    accountActivationToken = makeUserActivationToken({
      userId: user.entity.id.value,
    });

    await userRepository.create(user.entity);
    await userActivationTokenRepository.create(accountActivationToken.entity);
  });

  it("should be able to activate account", async () => {
    const { isRight } = await sut.execute<"success">({
      token: accountActivationToken.entity.token,
    });

    expect(isRight()).toBeTruthy();
    expect(userActivationTokenRepository.items).toHaveLength(0);
    expect(userRepository.items[0].activatedAt).toEqual(expect.any(Date));
  });

  it("should not be able to activate a non-existent account activation token", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      token: faker.string.alphanumeric(64),
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
      token: accountActivationToken.entity.token,
    });

    expect(validTokenResult.isRight()).toBeTruthy();

    await userActivationTokenRepository.create(accountActivationToken.entity);

    vi.advanceTimersByTime(oneMinuteInMilliseconds * 15);

    const invalidTokenResult = await sut.execute<"error">({
      token: accountActivationToken.entity.token,
    });

    expect(invalidTokenResult.isLeft()).toBeTruthy();
    expect(invalidTokenResult.reason).toBeInstanceOf(
      UserActivationTokenExpiredError,
    );

    vi.useRealTimers();
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to activate account without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        token: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to activate account with invalid token", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        token: faker.string.alphanumeric({ length: { min: 0, max: 63 } }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
