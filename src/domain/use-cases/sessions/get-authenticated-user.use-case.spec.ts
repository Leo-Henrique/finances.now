import { SESSION_DURATION_IN_MILLISECONDS } from "@/domain/entities/session.entity";
import { UnauthorizedError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeSession } from "test/factories/make-session";
import { makeUser } from "test/factories/make-user";
import { InMemorySessionRepository } from "test/repositories/in-memory-session.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GetAuthenticatedUserUseCase } from "./get-authenticated-user.use-case";

let sessionRepository: InMemorySessionRepository;
let userRepository: InMemoryUserRepository;

let sut: GetAuthenticatedUserUseCase;

let user: ReturnType<typeof makeUser>;
let session: ReturnType<typeof makeSession>;

describe("[Use Case] Get authenticated user", () => {
  beforeEach(async () => {
    sessionRepository = new InMemorySessionRepository();
    userRepository = new InMemoryUserRepository();

    sut = new GetAuthenticatedUserUseCase({
      sessionRepository,
      userRepository,
    });

    user = makeUser();
    session = makeSession({ userId: user.entity.id });

    await userRepository.create(user.entity);
    await sessionRepository.create(session.entity);
  });

  it("should be able to get a authenticated user", async () => {
    const { isRight, result } = await sut.execute<"success">({
      token: session.entity.token,
    });

    expect(isRight()).toBeTruthy();
    expect(result.user).not.toHaveProperty("password");
    expect(userRepository.items[0]).toMatchObject(result.user);
  });

  it("should be able to renew current session when getting authenticated user", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    vi.advanceTimersByTime(SESSION_DURATION_IN_MILLISECONDS / 2);

    const { isRight } = await sut.execute<"success">({
      token: session.entity.token,
    });

    const renewedSessionExpiration =
      Date.now() + SESSION_DURATION_IN_MILLISECONDS;

    expect(isRight()).toBeTruthy();
    expect(sessionRepository.items[0].expiresAt.getTime()).toEqual(
      renewedSessionExpiration,
    );

    vi.useRealTimers();
  });

  it("should not be able to get a user with non-existent session", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      token: faker.string.alphanumeric({ length: { min: 64, max: 512 } }),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to get a non-existent user", async () => {
    await userRepository.delete(user.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      token: session.entity.token,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });

  it("should not be able to get a user with an expired session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());

    const oneDayInMilliseconds = 1000 * 60 * 60 * 24;

    vi.advanceTimersByTime(oneDayInMilliseconds);

    const validSessionResult = await sut.execute<"success">({
      token: session.entity.token,
    });

    expect(validSessionResult.isRight()).toBeTruthy();

    vi.advanceTimersByTime(SESSION_DURATION_IN_MILLISECONDS);

    const invalidSessionResult = await sut.execute<"error">({
      token: session.entity.token,
    });

    expect(invalidSessionResult.isLeft()).toBeTruthy();
    expect(invalidSessionResult.reason).toBeInstanceOf(UnauthorizedError);

    vi.useRealTimers();
  });
});
