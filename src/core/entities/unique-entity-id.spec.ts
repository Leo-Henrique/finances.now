import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { UniqueEntityId } from "./unique-entity-id";

describe("[Value Object] Unique entity id", () => {
  it("should be able to create an unique entity id", async () => {
    const { value } = new UniqueEntityId();

    expect(value).toEqual(expect.any(String));
    expect(value).toHaveLength(36);
  });

  it("should be able to create the value object with existing id", async () => {
    const id = faker.string.uuid();
    const { value } = new UniqueEntityId(id);

    expect(value).toEqual(id);
  });

  describe("[Business Roles] generated schema", () => {
    it("should be able to validate input", async () => {
      const { success } = UniqueEntityId.schema.safeParse(faker.string.uuid());

      expect(success).toBeTruthy();
    });

    it("should be able to invalidate input that is not string", async () => {
      const { success } = UniqueEntityId.schema.safeParse(faker.number.int());

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input that is not UUID", async () => {
      const { success } = UniqueEntityId.schema.safeParse(
        faker.string.alphanumeric({ length: 36 }),
      );

      expect(success).toBeFalsy();
    });
  });
});
