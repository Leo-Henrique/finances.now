import { makeUser } from "test/factories/make-user";
import { FakeEncryption } from "test/gateways/auth/fake-encryption";
import { FakeEmailDispatcher } from "test/gateways/fake-email-dispatcher";
import { InMemoryAccountActivationTokenRepository } from "test/repositories/in-memory-account-activation-token.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { RequestAccountActivationUseCase } from "./request-account-activation.use-case";

let userRepository: InMemoryUserRepository;
let accountActivationTokenRepository: InMemoryAccountActivationTokenRepository;
let encryption: FakeEncryption;
let emailDispatcher: FakeEmailDispatcher;

let sut: RequestAccountActivationUseCase;

let user: ReturnType<typeof makeUser>;

describe("[Use Case] Request account activation", () => {
  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    accountActivationTokenRepository =
      new InMemoryAccountActivationTokenRepository({ userRepository });
    encryption = new FakeEncryption();
    emailDispatcher = new FakeEmailDispatcher();

    sut = new RequestAccountActivationUseCase({
      accountActivationTokenRepository,
      encryption,
      emailDispatcher,
    });

    user = makeUser();
  });

  it("should be able to request account activation", async () => {
    const { isRight, result } = await sut.execute<"success">({
      user: user.entity,
    });

    expect(isRight()).toBeTruthy();
    expect(result.accountActivationToken.userId).toEqual(user.entity.id);
    expect(accountActivationTokenRepository.items[0]).toMatchObject(
      result.accountActivationToken,
    );
    expect(
      accountActivationTokenRepository.items[0].expiresAt.getTime(),
    ).toBeGreaterThan(Date.now());
    expect(emailDispatcher.inbox).toHaveLength(1);
    expect(emailDispatcher.inbox[0].recipientId).toEqual(user.entity.id.value);
    expect(emailDispatcher.inbox[0].content).toEqual(
      accountActivationTokenRepository.items[0].token,
    );
  });
});
