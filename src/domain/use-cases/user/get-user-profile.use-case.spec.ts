import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeUser } from "test/factories/make-user";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { GetUserProfileUseCase } from "./get-user-profile.use-case";

let userRepository: InMemoryUserRepository;
let sut: GetUserProfileUseCase;
let user: ReturnType<typeof makeUser>;

describe("[Use Case] Get user profile", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    sut = new GetUserProfileUseCase({ userRepository });
    user = makeUser();

    await userRepository.create(user.entity);
  });

  it("should be able to get an user profile", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId: user.entity.id.value,
      targetUserId: user.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(user.entity).toMatchObject(result.user);
    expect(result.user).not.toHaveProperty("password");
  });

  it("should not be able to get a non-existent user profile", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: user.entity.id.value,
      targetUserId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to get a user profile by another user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      targetUserId: user.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });
});
