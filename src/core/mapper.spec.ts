import { describe, expect, it } from "vitest";
import { Mapper } from "./mapper";

const texts = {
  camelCase: "loremIpsumIsSimplyDummyText",
  pascalCase: "LoremIpsumIsSimplyDummyText",
  snakeCase: "lorem_ipsum_is_simply_dummy_text",
  kebabCase: "lorem-ipsum-is-simply-dummy-text",
};

const inputs = Object.values(texts);

describe("[Core] Mapper", () => {
  it("should be able to map text to camel case", async () => {
    for (const input of inputs) {
      const sut = Mapper.toCamelCase(input);

      expect(sut).toEqual(texts.camelCase);
    }
  });

  it("should be able to map text to snake case", async () => {
    for (const input of inputs) {
      const sut = Mapper.toSnakeCase(input);

      expect(sut).toEqual(texts.snakeCase);
    }
  });

  describe("With object properties", () => {
    const object = {
      [texts.camelCase]: 0,
      [texts.pascalCase]: 0,
      [texts.snakeCase]: 0,
    };

    it("should be able to map object properties to camel case", async () => {
      const sut = Mapper.toCamelCaseProperties(object);

      expect(Object.keys(sut)).toEqual(
        Object.keys(sut).map(() => texts.camelCase),
      );
    });

    it("should be able to map object properties to snake case", async () => {
      const sut = Mapper.toSnakeCaseProperties(object);

      expect(Object.keys(sut)).toEqual(
        Object.keys(sut).map(() => texts.snakeCase),
      );
    });
  });
});
