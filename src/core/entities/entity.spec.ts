import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EntityDefinition } from "../@types/entity";
import { EntityDataCreate } from "../@types/entity/entity-data-create";
import { Entity } from "./entity";
import { UniqueEntityId } from "./unique-entity-id";

type FakeUserCreate = EntityDataCreate<FakeUser>;

class FakeUser extends Entity implements EntityDefinition<FakeUser> {
  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }

  public static create(input: FakeUserCreate) {
    return new this().createEntity(input);
  }

  defineId() {
    return {
      schema: z.instanceof(UniqueEntityId),
      default: new UniqueEntityId(),
      static: true,
      readonly: true,
    };
  }

  defineFirstName() {
    return { schema: z.string() };
  }

  defineEmail() {
    return { schema: z.string().email(), readonly: true };
  }

  definePassword() {
    return { schema: z.number(), transform: (val: number) => val.toString() };
  }

  defineUpdatedAt() {
    return {
      schema: z.date().nullable(),
      default: null,
      static: true,
      readonly: true,
    };
  }
}

const fakeUserInput: FakeUserCreate = {
  firstName: faker.person.firstName(),
  email: faker.internet.email(),
  password: faker.number.int(),
};

describe("[Core] Domain Entity", () => {
  it("should be able to create an entity", () => {
    const user = FakeUser.create(fakeUserInput);

    expect(user).toMatchObject({
      ...fakeUserInput,
      password: fakeUserInput.password.toString(),
    });
  });

  it("should be able to update an entity", () => {
    const user = FakeUser.create(fakeUserInput);
    const updatedFirstName = faker.person.firstName();
    const updatedPassword = faker.number.int();

    user.update({ firstName: updatedFirstName, password: updatedPassword });

    expect(user.firstName).toEqual(updatedFirstName);
    expect(user.password).toEqual(updatedPassword.toString());
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  it("should be able to create an entity with field transformations", () => {
    const user = FakeUser.create(fakeUserInput);

    expect(user.password).toEqual(fakeUserInput.password.toString());
  });

  it("should be able to create an entity with default fields", () => {
    const user = FakeUser.create(fakeUserInput);

    expect(user.id).toBeInstanceOf(UniqueEntityId);
  });

  it("should be able to create an entity schemas for creation and update", () => {
    const user = FakeUser.create(fakeUserInput);

    const getFieldNames = (condition: "creatable" | "upgradeable") => {
      const proto = Object.getOwnPropertyNames(
        FakeUser.prototype,
      ) as (keyof EntityDefinition<FakeUser>)[];

      return proto
        .filter(name => name.startsWith("define"))
        .map(name => {
          const { readonly, static: _static } = (
            user as unknown as EntityDefinition<FakeUser>
          )[name]();
          const fieldNamePascalCase = name.replace("define", "");
          const fieldName =
            fieldNamePascalCase[0].toLowerCase() + fieldNamePascalCase.slice(1);

          if (condition === "creatable" && !_static) return fieldName;
          if (condition === "upgradeable" && !readonly) return fieldName;
        })
        .filter(Boolean);
    };

    expect(FakeUser.createSchema).toBeInstanceOf(z.ZodObject);
    expect(FakeUser.updateSchema).toBeInstanceOf(z.ZodObject);
    expect(Object.keys(FakeUser.createSchema.shape)).toEqual(
      getFieldNames("creatable"),
    );
    expect(Object.keys(FakeUser.updateSchema.shape)).toEqual(
      getFieldNames("upgradeable"),
    );
  });

  it("should be able to create an entity with fields inherited from sub classes", () => {
    const defaultLastName = faker.person.lastName();
    class AnotherFakeUser
      extends FakeUser
      implements EntityDefinition<AnotherFakeUser>
    {
      static create(input: EntityDataCreate<AnotherFakeUser>) {
        return new this().createEntity(input);
      }

      defineFirstName() {
        return { schema: z.string() };
      }

      defineLastName() {
        return { schema: z.string(), default: defaultLastName };
      }
    }

    const user = AnotherFakeUser.create(fakeUserInput);

    expect(user).toMatchObject({
      ...fakeUserInput,
      password: fakeUserInput.password.toString(),
    });
    expect(user.id).toBeInstanceOf(UniqueEntityId);
    expect(user.lastName).toEqual(defaultLastName);
  });
});
