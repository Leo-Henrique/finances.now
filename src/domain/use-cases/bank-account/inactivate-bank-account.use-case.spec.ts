import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { InactivateBankAccountUseCase } from "./inactivate-bank-account.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let sut: InactivateBankAccountUseCase;
let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;

describe("[Use Case] Inactivate bank account", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    sut = new InactivateBankAccountUseCase({
      bankAccountRepository,
    });
    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to inactivate a bank account", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      bankAccountId: bankAccount.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.bankAccount.id.value).toEqual(bankAccount.entity.id.value);
    expect(bankAccountRepository.items[0].inactivatedAt).toBeInstanceOf(Date);
  });

  it("should be able to reactivate a bank account", async () => {
    await sut.execute<"success">({
      userId,
      bankAccountId: bankAccount.entity.id.value,
    });

    const { isRight, result } = await sut.execute<"success">({
      userId,
      bankAccountId: bankAccount.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.bankAccount.id.value).toEqual(bankAccount.entity.id.value);
    expect(bankAccountRepository.items[0].inactivatedAt).toBeNull();
  });

  it("should not be able to inactivate a non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      bankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to inactivate a bank account if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      bankAccountId: bankAccount.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to inactivate a bank account without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        bankAccountId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
