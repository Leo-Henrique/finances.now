import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EntityDataCreate } from "../@types/entity/entity-data-create";
import { BaseEntity } from "./base-entity";
import { UniqueEntityId } from "./unique-entity-id";

type FakeUserCreate = EntityDataCreate<sut>;

class sut extends BaseEntity {
  defineFirstName() {
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

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }

  static create(input: FakeUserCreate) {
    return new this().createEntity(input);
  }
}

const fakeUserInput: FakeUserCreate = {
  firstName: faker.person.firstName(),
  email: faker.internet.email(),
};

describe("[Core] Base Entity", () => {
  it("should be able to create an entity from the base entity", () => {
    const user = sut.create(fakeUserInput);

    expect(user).toMatchObject(fakeUserInput);
    expect(user.id).toBeInstanceOf(UniqueEntityId);
    expect(user.updatedAt).toBeNull();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  it("should not be able to create or update base fields in validations", () => {
    const fieldNames = ["id", "updatedAt", "createdAt"];

    for (const fieldName of fieldNames) {
      expect(Object.keys(sut.createSchema.shape)).not.toHaveProperty(fieldName);
      expect(Object.keys(sut.updateSchema.shape)).not.toHaveProperty(fieldName);
    }
  });
});
