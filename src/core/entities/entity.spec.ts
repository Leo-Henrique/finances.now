import { faker } from "@faker-js/faker";
import { MockInstance, beforeEach, describe, expect, it, vi } from "vitest";
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

class sut extends Entity {
  defineId() {
    return this.createField({
      schema: z.instanceof(UniqueEntityId),
      default: new UniqueEntityId(),
      static: true,
      readonly: true,
    });
  }

  defineFirstName() {
    return this.createField({
      schema: z.string().optional(),
    });
  }

  defineLastName() {
    return this.createField({
      schema: z.string().nullable(),
      default: null,
    });
  }

  defineFullName() {
    return this.createField({
      schema: z.string(),
    });
  }

  defineEmail() {
    return this.createField({
      schema: z.string().email(),
      readonly: true,
    });
  }

  definePassword() {
    return this.createField({
      schema: z.number(),
      default: 123,
      transform: (val: number) => val.toString(),
    });
  }

  defineAge() {
    return this.createField({
      schema: z.union([z.number(), z.undefined()]),
      default: 18,
      transform: (val: number | undefined) => {
        if (typeof val === "number") return val.toFixed(2);
      },
    });
  }

  defineUpdatedAt() {
    return this.createField({
      schema: z.date().nullable(),
      default: null,
      static: true,
      readonly: true,
    });
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

const input: FakeUserEntityCreate = {
  firstName: faker.person.firstName(),
  fullName: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.number.int(),
};

describe("[Core] Domain Entity", () => {
  describe("creation entity", () => {
    it("should be able to create an entity", () => {
      const user = sut.create(input);

      expect(user).toMatchObject({
        ...input,
        password: input.password?.toString(),
      });
    });

    it("should be able to create an entity with default fields", () => {
      const user = sut.create(input);

      expect(user.id).toBeInstanceOf(UniqueEntityId);
    });

    it("should be able to create an entity with fields inherited from sub classes", () => {
      const defaultHeight = faker.number.int();
      class AnotherFakeUserEntity extends sut {
        static create(input: EntityDataCreate<AnotherFakeUserEntity>) {
          return new this().createEntity(input);
        }

        defineFirstName() {
          return this.createField({
            ...super.defineFirstName(),
            transform: (val: string | undefined) => val + "_transformed",
          });
        }

        defineHeight() {
          return this.createField({
            schema: z.number(),
            default: defaultHeight,
          });
        }
      }

      const user = AnotherFakeUserEntity.create(input);

      expect(user.id).toBeInstanceOf(UniqueEntityId);
      expect(user.email).toEqual(input.email);
      expect(user.password).toEqual(input.password?.toString());
      expect(user.firstName).toEqual(input.firstName + "_transformed");
      expect(user.height).toEqual(defaultHeight);
    });
  });

  describe("update entity", () => {
    it("should be able to update an entity", () => {
      const user = sut.create(input);
      const updatedFirstName = faker.person.firstName();

      user.update({ firstName: updatedFirstName });

      expect(user.firstName).toEqual(updatedFirstName);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it("should be able to update only fields with values distinct from the originals", () => {
      const user = sut.create(input);
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

  describe("field transformations", () => {
    it("should be able to apply field transformations in creation the entity", () => {
      const user = sut.create(input);

      expect(user.password).toEqual(input.password?.toString());
    });

    it("should be able to apply field transformations in update the entity", () => {
      const user = sut.create(input);
      const updatedPassword = faker.number.int();

      user.update({ password: updatedPassword });

      expect(user.password).toEqual(updatedPassword.toString());
    });

    it("should be able to apply transformations to fields with default values in creation the entity", () => {
      const defaultPassword = "123";
      // eslint-disable-next-line
      const { password, ...inputWithoutPassword } = input;
      const user = sut.create(inputWithoutPassword);
      const anotherUser = sut.create({ ...input, password: undefined });

      expect(user.password).toEqual(defaultPassword);
      expect(anotherUser.password).toEqual(defaultPassword);
    });

    it("should be able to not apply transformations to fields with default values that have not been updated", () => {
      const user = sut.create(input);

      user.update({ lastName: faker.person.lastName() });

      expect(user.password).toEqual(input.password?.toString());
    });

    it("should not be able to apply transformations to fields with default values that receive and accept undefined values in creation the entity", () => {
      const defaultAge = 18;
      const customAge = 20;

      const userWithDefaultAge = sut.create(input);
      const userWithoutAge = sut.create({ ...input, age: undefined });
      const userWithCustomAge = sut.create({ ...input, age: customAge });

      expect(userWithDefaultAge.age).toEqual(defaultAge.toFixed(2));
      expect(userWithoutAge.age).toBeUndefined();
      expect(userWithCustomAge.age).toEqual(customAge.toFixed(2));
    });

    it("should not be able to apply transformations to fields that receive and do not accept undefined values in update the entity", () => {
      const user = sut.create({ ...input, age: faker.number.int() });

      user.update({ password: undefined, age: undefined });

      expect(user.password).toEqual(input.password?.toString());
      expect(user.age).toBeUndefined();
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
      const user = sut.create(input);
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
      const user = sut.create(input);
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
      const user = sut.create(input);
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

  describe("events", () => {
    describe("definition event", () => {
      let firstNameDefinitionEvent: MockInstance;
      let lastNameDefinitionEvent: MockInstance;
      let fullNameDefinitionEvent: MockInstance;

      beforeEach(() => {
        const firstNameMock = {
          ...sut.prototype.defineFirstName(),
          onDefinition: vi.fn(),
        };
        const lastNameMock = {
          ...sut.prototype.defineLastName(),
          onDefinition: vi.fn(),
        };
        const fullNameMock = {
          ...sut.prototype.defineFullName(),
          onDefinition: vi.fn(),
        };

        firstNameDefinitionEvent = vi.spyOn(firstNameMock, "onDefinition");
        lastNameDefinitionEvent = vi.spyOn(lastNameMock, "onDefinition");
        fullNameDefinitionEvent = vi.spyOn(fullNameMock, "onDefinition");

        vi.spyOn(sut.prototype, "defineFirstName").mockReturnValue(
          firstNameMock,
        );
        vi.spyOn(sut.prototype, "defineLastName").mockReturnValue(lastNameMock);
        vi.spyOn(sut.prototype, "defineFullName").mockReturnValue(fullNameMock);
      });

      it("should be able to dispatch definition event on creation of entity", () => {
        sut.create(input);

        expect(firstNameDefinitionEvent).toHaveBeenCalledTimes(1);
      });

      it("should be able to dispatch definition event on update of entity", () => {
        const user = sut.create(input);

        user.update({ firstName: faker.person.firstName() });

        expect(firstNameDefinitionEvent).toHaveBeenCalledTimes(2);
      });

      it("should be able to dispatch definition event when the field was not created but has a default value", () => {
        // eslint-disable-next-line
        const { lastName, ...inputWithoutLastName } = input;
        const user = sut.create(inputWithoutLastName);

        user.update({ age: faker.number.int() });

        expect(lastNameDefinitionEvent).toHaveBeenCalledTimes(1);
      });

      it("should not be able to dispatch definition event to fields that receive and not accept undefined values in creation and update the entity", () => {
        const inputWithoutFullName: FakeUserEntityCreate = {
          ...input,
          // @ts-expect-error: unexpected field value
          fullName: undefined,
        };
        const userWithoutFullName = sut.create(inputWithoutFullName);
        const userWithDefaultLastName = sut.create({
          ...inputWithoutFullName,
          lastName: undefined,
        });

        userWithoutFullName.update({ fullName: undefined });
        userWithDefaultLastName.update({ lastName: undefined });

        expect(fullNameDefinitionEvent).not.toHaveBeenCalled();
        expect(lastNameDefinitionEvent).toHaveBeenCalledTimes(2);
      });

      it("should not be able to dispatch definition event when the equivalent field is not created", () => {
        // eslint-disable-next-line
        const { firstName, ...inputWithoutFirstName } = input;

        sut.create(inputWithoutFirstName);

        expect(firstNameDefinitionEvent).not.toHaveBeenCalled();
      });

      it("should not be able to dispatch definition event when the equivalent field is not updated", () => {
        // eslint-disable-next-line
        const { firstName, ...inputWithoutFirstName } = input;
        const user = sut.create(inputWithoutFirstName);

        user.update({ lastName: faker.person.lastName() });
        user.update({ age: faker.number.int() });

        expect(firstNameDefinitionEvent).not.toHaveBeenCalled();
        expect(lastNameDefinitionEvent).toHaveBeenCalledTimes(2);
      });
    });
  });
});
