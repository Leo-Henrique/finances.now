import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { Name } from "./name";
import { Slug } from "./slug";

const text = " Example text 123 ";
const slug = "example-text-123";

describe("[Value Object] Slug", () => {
  it("should be able to create an slug", async () => {
    const { value } = new Slug(text);

    expect(value).toEqual(slug);
  });

  it("should be able to remove input containing special characters", async () => {
    const symbols = faker.string.symbol(50);
    const { value } = new Slug(`${symbols} ${text} ${symbols} ${text}`);

    expect(value).toEqual(`${slug}-${slug}`);
  });

  it("should be able to remove input containing emojis", async () => {
    const emojis = faker.internet.emoji();
    const { value } = new Slug(`${emojis} ${text} ${emojis} ${text}`);

    expect(value).toEqual(`${slug}-${slug}`);
  });

  describe("[Business Roles] generated schema", () => {
    it("should be able to validate input", async () => {
      const result = [];

      for (let i = 1; i <= 10; i++) {
        const personNameResult = Slug.schema.safeParse(faker.lorem.sentence());

        result.push(personNameResult.success);
      }

      expect(result).toEqual(result.map(() => true));
    });

    it("should be able to invalidate input that is not string", async () => {
      const { success } = Name.schema.safeParse(faker.number.int());

      expect(success).toBeFalsy();
    });
  });
});
