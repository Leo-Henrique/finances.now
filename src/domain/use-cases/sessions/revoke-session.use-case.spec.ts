import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeSession } from "test/factories/make-session";
import { InMemorySessionRepository } from "test/repositories/in-memory-session.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { RevokeSessionUseCase } from "./revoke-session.use-case";

let sessionRepository: InMemorySessionRepository;

let sut: RevokeSessionUseCase;

let session: ReturnType<typeof makeSession>;

describe("[Use Case] Revoke session", () => {
  beforeEach(async () => {
    sessionRepository = new InMemorySessionRepository();

    sut = new RevokeSessionUseCase({
      sessionRepository,
    });

    session = makeSession({ userId: new UniqueEntityId() });

    await sessionRepository.create(session.entity);
  });

  it("should be able to revoke a session", async () => {
    const { isRight } = await sut.execute<"success">({
      token: session.entity.token,
    });

    expect(isRight()).toBeTruthy();
    expect(sessionRepository.items[0].expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("should not be able to revoke a non-existent session", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      token: faker.string.alphanumeric({ length: { min: 64, max: 512 } }),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });
});
