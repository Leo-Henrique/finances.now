import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  EntityDataUpdateZodShape,
  EntityDataZodShape,
  EntityDefinition,
  EntityInstance,
} from "../@types/entity";
import {
  EntityDataCreate,
  EntityDataCreateZodShape,
} from "../@types/entity/entity-data-create";
import { Entity } from "./entity";
import { UniqueEntityId } from "./unique-entity-id";

type FakeUser = EntityInstance<sut>;

type FakeUserEntityCreate = EntityDataCreate<sut>;

class sut extends Entity implements EntityDefinition<sut> {
  defineId() {
    return {
      schema: z.instanceof(UniqueEntityId),
      default: new UniqueEntityId(),
      static: true,
      readonly: true,
    };
  }

  defineFirstName() {
    return { schema: z.string().optional() };
  }

  defineLastName() {
    return { schema: z.string().nullable(), default: null };
  }

  defineEmail() {
    return { schema: z.string().email(), readonly: true };
  }

  definePassword() {
    return {
      schema: z.number(),
      default: 123,
      transform: (val: number) => val.toString(),
    };
  }

  defineUpdatedAt() {
    return {
      schema: z.date().nullable(),
      default: null,
      static: true,
      readonly: true,
    };
  }

  public static get baseSchema() {
    return new this().baseSchema;
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }

  public static create(input: FakeUserEntityCreate) {
    return new this().createEntity(input);
  }
}

const fakeUserEntityInput: FakeUserEntityCreate = {
  firstName: faker.person.firstName(),
  email: faker.internet.email(),
  password: faker.number.int(),
};

describe("[Core] Domain Entity", () => {
  describe("creation entity", () => {
    it("should be able to create an entity", () => {
      const user = sut.create(fakeUserEntityInput);

      expect(user).toMatchObject({
        ...fakeUserEntityInput,
        password: fakeUserEntityInput.password?.toString(),
      });
    });

    it("should be able to create an entity applying field transformations", () => {
      // eslint-disable-next-line
      const { password, ...inputWithoutPassword } = fakeUserEntityInput;

      const user = sut.create(fakeUserEntityInput);
      const userWithDefaultPassword = sut.create(inputWithoutPassword);
      const anotherUserWithDefaultPassword = sut.create({
        ...fakeUserEntityInput,
        password: undefined,
      });

      expect(user.password).toEqual(fakeUserEntityInput.password?.toString());
      expect(userWithDefaultPassword.password).toEqual(
        userWithDefaultPassword.password.toString(),
      );
      expect(anotherUserWithDefaultPassword.password).toEqual(
        anotherUserWithDefaultPassword.password.toString(),
      );
    });

    it("should be able to create an entity with default fields", () => {
      const user = sut.create(fakeUserEntityInput);

      expect(user.id).toBeInstanceOf(UniqueEntityId);
    });

    it("should be able to create an entity with fields inherited from sub classes", () => {
      const defaultAge = faker.number.int({ min: 16, max: 150 });
      class AnotherFakeUserEntity
        extends sut
        implements EntityDefinition<AnotherFakeUserEntity>
      {
        static create(input: EntityDataCreate<AnotherFakeUserEntity>) {
          return new this().createEntity(input);
        }

        defineFirstName() {
          return { schema: z.string().optional() };
        }

        defineAge() {
          return { schema: z.number(), default: defaultAge };
        }
      }

      const user = AnotherFakeUserEntity.create(fakeUserEntityInput);

      expect(user).toMatchObject({
        ...fakeUserEntityInput,
        password: fakeUserEntityInput.password?.toString(),
      });
      expect(user.id).toBeInstanceOf(UniqueEntityId);
      expect(user.age).toEqual(defaultAge);
    });
  });

  describe("update entity", () => {
    it("should be able to update an entity", () => {
      const user = sut.create(fakeUserEntityInput);
      const updatedFirstName = faker.person.firstName();

      user.update({ firstName: updatedFirstName });

      expect(user.firstName).toEqual(updatedFirstName);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("should be able to update an entity applying field transformations", () => {
      const user = sut.create(fakeUserEntityInput);
      const updatedPassword = faker.number.int();

      user.update({ password: updatedPassword });

      expect(user.password).toEqual(updatedPassword.toString());
    });

    it("should be able to update only fields with values distinct from the originals", () => {
      const user = sut.create(fakeUserEntityInput);
      const updatedPassword = faker.number.int();

      const updatedFields = user.update({
        firstName: user.firstName,
        password: updatedPassword,
      });

      expect(updatedFields).not.toHaveProperty("firstName");
      expect(updatedFields.password).toEqual(updatedPassword.toString());
      expect(user.password).toEqual(updatedPassword.toString());
    });
  });

  describe("entity schemas", () => {
    const getFieldNames = (
      instance: FakeUser,
      condition: "all" | "creatable" | "upgradeable" | "default" = "all",
    ) => {
      const proto = Object.getOwnPropertyNames(
        sut.prototype,
      ) as (keyof EntityDefinition<sut>)[];

      return proto
        .filter(name => name.startsWith("define"))
        .map(name => {
          const definition = (instance as unknown as EntityDefinition<sut>)[
            name
          ]();
          const { readonly, static: _static } = definition;
          const fieldNamePascalCase = name.replace("define", "");
          const fieldName =
            fieldNamePascalCase[0].toLowerCase() + fieldNamePascalCase.slice(1);

          if (condition === "all") return fieldName;

          if (condition === "creatable" && !_static) return fieldName;

          if (condition === "upgradeable" && !readonly) return fieldName;

          if (condition === "default" && "default" in definition)
            return fieldName;
        })
        .filter(Boolean);
    };

    it("should be able to generate base schema", () => {
      const user = sut.create(fakeUserEntityInput);
      const { shape } = sut.baseSchema;
      const baseSchemaFieldNames = Object.keys(
        shape,
      ) as (keyof EntityDataZodShape<sut>)[];

      expect(sut.baseSchema).toBeInstanceOf(z.ZodObject);
      expect(baseSchemaFieldNames).toEqual(getFieldNames(user));

      for (const fieldName of baseSchemaFieldNames) {
        expect(shape[fieldName]).toBeInstanceOf(z.ZodType);
        expect(shape[fieldName]).not.toBeInstanceOf(z.ZodDefault);
      }
    });

    it("should be able to generate schema for creation", () => {
      const user = sut.create(fakeUserEntityInput);
      const { shape } = sut.createSchema;
      const createSchemaFieldNames = Object.keys(
        shape,
      ) as (keyof EntityDataCreateZodShape<sut>)[];

      expect(sut.createSchema).toBeInstanceOf(z.ZodObject);
      expect(createSchemaFieldNames).toEqual(getFieldNames(user, "creatable"));

      for (const fieldName of createSchemaFieldNames) {
        expect(shape[fieldName]).toBeInstanceOf(z.ZodType);

        if (getFieldNames(user, "default").includes(fieldName))
          expect(shape[fieldName]).toBeInstanceOf(z.ZodDefault);
      }
    });

    it("should be able to generate schema for update", () => {
      const user = sut.create(fakeUserEntityInput);
      const { shape } = sut.updateSchema;
      const updateSchemaFieldNames = Object.keys(
        shape,
      ) as (keyof EntityDataUpdateZodShape<sut>)[];

      expect(sut.updateSchema).toBeInstanceOf(z.ZodObject);
      expect(updateSchemaFieldNames).toEqual(
        getFieldNames(user, "upgradeable"),
      );

      for (const fieldName of updateSchemaFieldNames) {
        expect(shape[fieldName]).toBeInstanceOf(z.ZodType);
        expect(shape[fieldName]).toBeInstanceOf(z.ZodOptional);
        expect(shape[fieldName]).not.toBeInstanceOf(z.ZodDefault);
      }
    });
  });
});
