import { compare } from "bcryptjs";
import { describe, expect, it } from "vitest";
import { PasswordHash } from "./password-hash";

describe("[Value Object] Password Hash", () => {
  it("should be able to create password hash", async () => {
    const password = "123456";

    const { hash } = new PasswordHash(password);
    const isMatchedPassword = await compare(password, hash);

    expect(hash).not.toBe(password);
    expect(isMatchedPassword).toBeTruthy();
  });
});
