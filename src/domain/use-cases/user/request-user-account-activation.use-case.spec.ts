import { makeUser } from "test/factories/make-user";
import { FakeEncryption } from "test/gateways/cryptology/fake-encryption";
import { FakeEmailDispatcher } from "test/gateways/fake-email-dispatcher";

import { beforeEach, describe, expect, it } from "vitest";
import { RequestUserAccountActivationUseCase } from "./request-user-account-activation.use-case";

let encryption: FakeEncryption;
let emailDispatcher: FakeEmailDispatcher;

let sut: RequestUserAccountActivationUseCase;

let user: ReturnType<typeof makeUser>;

describe("[Use Case] Request user account activation", () => {
  beforeEach(() => {
    encryption = new FakeEncryption();
    emailDispatcher = new FakeEmailDispatcher();

    sut = new RequestUserAccountActivationUseCase({
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
    expect(result.userActivationToken.userId).toEqual(user.entity.id);
    expect(emailDispatcher.inbox).toHaveLength(1);
    expect(emailDispatcher.inbox[0].recipientId).toEqual(user.entity.id.value);
    expect(emailDispatcher.inbox[0].content).toEqual(
      result.userActivationToken.token,
    );
  });
});
