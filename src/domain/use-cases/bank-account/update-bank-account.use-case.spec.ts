import { ValidationError } from "@/core/errors/errors";
import { Slug } from "@/domain/entities/value-objects/slug";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { UpdateBankAccountUseCase } from "./update-bank-account.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let sut: UpdateBankAccountUseCase;
let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;

describe("[Use Case] Update bank account", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    sut = new UpdateBankAccountUseCase({
      bankAccountRepository,
    });
    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to update a bank account", async () => {
    const updatedInstitution = faker.company.name();
    const { isRight, result } = await sut.execute<"success">({
      userId,
      bankAccountId: bankAccount.entity.id.value,
      data: { institution: updatedInstitution },
    });

    expect(isRight()).toBeTruthy();
    expect(result.bankAccount.id.value).toEqual(bankAccount.entity.id.value);
    expect(bankAccountRepository.items[0].institution.value).toEqual(
      updatedInstitution,
    );
    expect(bankAccountRepository.items[0].slug).toEqual(
      new Slug(updatedInstitution),
    );
  });

  it("should not be able to update a non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      bankAccountId: faker.string.uuid(),
      data: { institution: faker.company.name() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a bank account if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      bankAccountId: bankAccount.entity.id.value,
      data: { institution: faker.company.name() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a bank account with one institution name already exists for that same user", async () => {
    const anotherBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(anotherBankAccount.entity);

    const sameInstitutionOfOwnCardResult = await sut.execute<"success">({
      userId,
      bankAccountId: bankAccount.entity.id.value,
      data: { institution: bankAccount.entity.institution.value },
    });
    const sameInstitutionOfAnotherBankAccountResult =
      await sut.execute<"error">({
        userId,
        bankAccountId: bankAccount.entity.id.value,
        data: { institution: anotherBankAccount.entity.institution.value },
      });

    expect(sameInstitutionOfOwnCardResult.isRight()).toBeTruthy();
    expect(sameInstitutionOfAnotherBankAccountResult.isLeft()).toBeTruthy();
    expect(sameInstitutionOfAnotherBankAccountResult.reason).toBeInstanceOf(
      ResourceAlreadyExistsError,
    );
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a bank account without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        bankAccountId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a bank account without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        bankAccountId: bankAccount.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a bank account with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        bankAccountId: bankAccount.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          userId: faker.string.uuid(),
          balance: faker.number.int(),
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
