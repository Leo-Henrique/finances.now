import { faker } from "@faker-js/faker";
import { compare } from "bcryptjs";
import { beforeEach, describe, expect, it } from "vitest";
import { PasswordHash } from "./password-hash";

let password: string;

describe("[Value Object] Password Hash", () => {
  beforeEach(() => {
    password = faker.internet.password();
  });

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

  describe("[Business Roles] generated schema", () => {
    it("should be able to validate input", async () => {
      const { success } = PasswordHash.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 6, max: 60 } }),
      );

      expect(success).toBeTruthy();
    });

    it("should be able to invalidate input that is not string", async () => {
      const { success } = PasswordHash.schema.safeParse(faker.number.int());

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input with less than 6 characters", async () => {
      const { success } = PasswordHash.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 0, max: 5 } }),
      );

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input with greater than 60 characters", async () => {
      const { success } = PasswordHash.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 61, max: 100 } }),
      );

      expect(success).toBeFalsy();
    });
  });
});
