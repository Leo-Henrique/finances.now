import { faker } from "@faker-js/faker";
import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { PasswordHash } from "./password-hash";

const password = "123456";

describe("[Value Object] Password Hash", () => {
  it("should be able to create password hash", async () => {
    const { hash } = new PasswordHash(password);
    const isMatchedPassword = await compare(password, hash);

    expect(hash).not.toBe(password);
    expect(isMatchedPassword).toBeTruthy();
  });

  it("should be able to check if a string match a hash", async () => {
    const passwordObject = new PasswordHash(password);
    const validPassword = passwordObject.match(password);
    const invalidPassword = passwordObject.match(faker.internet.password());

    expect(validPassword).toBeTruthy();
    expect(invalidPassword).toBeFalsy();
  });
});
