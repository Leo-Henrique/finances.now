import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  EntityDataCreate,
  EntityDataUpdated,
  EntityInstance,
} from "../@types/entity";
import { Entity } from "../entities/entity";
import { UniqueEntityId } from "../entities/unique-entity-id";
import { InMemoryBaseRepository } from "./in-memory-base-repository";

export type FakeUser = EntityInstance<FakeUserEntity>;

export type FakeUserDataCreate = EntityDataCreate<FakeUserEntity>;

export type FakeUserDataUpdated = EntityDataUpdated<FakeUserEntity>;

class FakeUserEntity extends Entity {
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
      schema: z.string(),
    });
  }

  defineLastName() {
    return this.createField({
      schema: z.string().optional(),
    });
  }

  public static create(input: FakeUserDataCreate) {
    return new this().createEntity(input);
  }

  public static get createSchema() {
    return new this().createSchema;
  }

  public static get updateSchema() {
    return new this().updateSchema;
  }
}

class InMemoryFakeUserRepository extends InMemoryBaseRepository<
  FakeUserEntity,
  FakeUser,
  FakeUserDataUpdated
> {}

let fakeUser: FakeUser;
let anotherFakeUser: FakeUser;
let sut: InMemoryFakeUserRepository;

describe("[Core] In Memory Base Repository", () => {
  beforeEach(async () => {
    fakeUser = FakeUserEntity.create({
      firstName: faker.person.firstName(),
    });
    anotherFakeUser = FakeUserEntity.create({
      firstName: faker.person.firstName(),
    });
    sut = new InMemoryFakeUserRepository();
  });

  it("should be able to create an in-memory repository that extends the base repository", async () => {
    const coreOperations = [
      "create",
      "update",
      "delete",
    ] as (keyof InMemoryFakeUserRepository)[];

    expect(sut.items).toEqual([]);

    for (const operation of coreOperations) {
      expect(sut[operation]).toBeInstanceOf(Function);
    }
  });

  it("should be able to save created entity in memory", async () => {
    await sut.create(fakeUser);
    await sut.create(anotherFakeUser);

    expect(sut.items).toEqual([fakeUser, anotherFakeUser]);
  });

  it("should be able to save updated entity in memory", async () => {
    const updatedFakeUser: FakeUserDataUpdated = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
    };

    await sut.create(fakeUser);
    await sut.create(anotherFakeUser);
    await sut.update(fakeUser, updatedFakeUser);

    expect(sut.items[1]).toEqual(anotherFakeUser);
    expect(sut.items[0]).toMatchObject(fakeUser);
    expect(sut.items[0].firstName).toEqual(updatedFakeUser.firstName);
    expect(sut.items[0].lastName).toEqual(updatedFakeUser.lastName);
  });

  it("should be able to save deleted entity in memory", async () => {
    await sut.create(fakeUser);
    await sut.create(anotherFakeUser);
    await sut.delete(fakeUser);

    expect(sut.items).toEqual([anotherFakeUser]);
  });
});
