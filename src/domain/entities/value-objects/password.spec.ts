import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { Password } from "./password";

let password: string;

describe("[Value Object] Password", () => {
  beforeEach(() => {
    password = faker.internet.password();
  });

  it("should be able to create a password", async () => {
    const { value } = new Password(password);

    expect(value).toEqual(password);
  });

  describe("[Business Roles] generated schema", () => {
    it("should be able to validate input", async () => {
      const { success } = Password.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 6, max: 60 } }),
      );

      expect(success).toBeTruthy();
    });

    it("should be able to invalidate input that is not string", async () => {
      const { success } = Password.schema.safeParse(faker.number.int());

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input with less than 6 characters", async () => {
      const { success } = Password.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 0, max: 5 } }),
      );

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input with greater than 60 characters", async () => {
      const { success } = Password.schema.safeParse(
        faker.string.alphanumeric({ length: { min: 61, max: 100 } }),
      );

      expect(success).toBeFalsy();
    });
  });
});
