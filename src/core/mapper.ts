import {
  CamelCase,
  CamelCasedProperties,
  SnakeCase,
  SnakeCasedProperties,
} from "type-fest";

export class Mapper {
  public static toCamelCase<T extends string>(text: T) {
    return text
      .replace(/[^a-zA-Z0-9]+/g, " ")
      .trim()
      .split(/(?=[A-Z])|\s+/)
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
      )
      .join("") as CamelCase<T>;
  }

  public static toSnakeCase<T extends string>(text: T) {
    return text
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .toLowerCase()
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "") as SnakeCase<T>;
  }

  public static toCamelCaseProperties<T extends Record<string, unknown>>(
    target: T,
  ) {
    return Object.keys(target).reduce(
      (obj, key) => {
        obj[Mapper.toCamelCase(key)] = target[key as keyof T];

        return obj;
      },
      {} as Record<string, unknown>,
    ) as CamelCasedProperties<T>;
  }

  public static toSnakeCaseProperties<T extends Record<string, unknown>>(
    target: T,
  ) {
    return Object.keys(target).reduce(
      (obj, key) => {
        obj[Mapper.toSnakeCase(key)] = target[key as keyof T];

        return obj;
      },
      {} as Record<string, unknown>,
    ) as SnakeCasedProperties<T>;
  }
}
