import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { Name } from "./name";

let name: string;

describe("[Value Object] Name", () => {
  beforeEach(() => {
    name = faker.person.fullName();
  });

  it("should be able to create an name", async () => {
    const { value } = new Name(name);

    expect(value).toEqual(name);
  });

  describe("[Business Roles] generated schema", () => {
    it("should be able to validate input", async () => {
      const personNamesResult = [];
      const companyNamesResult = [];

      for (let i = 1; i <= 50; i++) {
        const personNameResult = Name.schema.safeParse(faker.person.fullName());
        const companyNameResult = Name.schema.safeParse(faker.company.name());

        personNamesResult.push(personNameResult.success);
        companyNamesResult.push(companyNameResult.success);
      }

      expect(personNamesResult).toEqual(personNamesResult.map(() => true));
      expect(companyNamesResult).toEqual(companyNamesResult.map(() => true));
    });

    it("should be able to invalidate input that is not string", async () => {
      const { success } = Name.schema.safeParse(faker.number.int());

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input containing numbers", async () => {
      const { success } = Name.schema.safeParse(
        `${name} ${faker.number.int()}`,
      );

      expect(success).toBeFalsy();
    });

    it("should be able to invalidate input containing special characters", async () => {
      const result = [];

      for (let i = 1; i <= 50; i++) {
        const a = faker.string.symbol();
        const validateResult = Name.schema.safeParse(`${name} ${a}`);

        if (validateResult.success) {
          const character = validateResult.data.replace(`${name} `, "");

          result.push(Name.regex.source.includes(character));
        } else {
          result.push(validateResult.success);
        }
      }

      expect(result).toEqual(result.map(() => false));
    });

    it("should be able to invalidate input containing emoji", async () => {
      const result = [];

      for (let i = 1; i <= 50; i++) {
        const { success } = Name.schema.safeParse(
          `${name} ${faker.internet.emoji()}`,
        );

        result.push(success);
      }

      expect(result).toEqual(result.map(() => false));
    });

    it("should be able to remove spacings the beginning and end of the name", async () => {
      const result = Name.schema.safeParse(`  ${name}  `);

      if (result.success) {
        expect(result.data).toEqual(name.trim());
      }
    });
  });
});
