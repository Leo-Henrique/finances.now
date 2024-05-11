import { ValidationError } from "@/core/errors/errors";
import { Slug } from "@/domain/entities/value-objects/slug";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeCreditCard } from "test/factories/make-credit-card";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { UpdateCreditCardUseCase } from "./update-credit-card.use-case";

let creditCardRepository: InMemoryCreditCardRepository;
let bankAccountRepository: InMemoryBankAccountRepository;

let sut: UpdateCreditCardUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let creditCard: ReturnType<typeof makeCreditCard>;

describe("[Use Case] Update credit card", () => {
  beforeEach(async () => {
    creditCardRepository = new InMemoryCreditCardRepository();
    bankAccountRepository = new InMemoryBankAccountRepository();

    sut = new UpdateCreditCardUseCase({
      creditCardRepository,
      bankAccountRepository,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });
    creditCard = makeCreditCard({
      userId,
      bankAccountId: bankAccount.entity.id.value,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await creditCardRepository.create(creditCard.entity);
  });

  it("should be able to update a credit card", async () => {
    const newBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(newBankAccount.entity);

    const updatedName = faker.lorem.sentence();
    const { isRight, result } = await sut.execute<"success">({
      userId,
      creditCardId: creditCard.entity.id.value,
      data: {
        bankAccountId: newBankAccount.entity.id.value,
        name: updatedName,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(result.creditCard.id.value).toEqual(creditCard.entity.id.value);
    expect(creditCardRepository.items[0].bankAccountId).toEqual(
      newBankAccount.entity.id,
    );
    expect(creditCardRepository.items[0].name.value).toEqual(updatedName);
    expect(creditCardRepository.items[0].slug).toEqual(new Slug(updatedName));
  });

  it("should not be able to update a non-existent credit card", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditCardId: faker.string.uuid(),
      data: { name: faker.lorem.sentence() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit card if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditCardId: creditCard.entity.id.value,
      data: { name: faker.lorem.sentence() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit card with a bank account that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditCardId: creditCard.entity.id.value,
      data: {
        bankAccountId: bankAccountFromAnotherUser.entity.id.value,
      },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit card with a bank account inactivated", async () => {
    await bankAccountRepository.update(bankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditCardId: creditCard.entity.id.value,
      data: {
        bankAccountId: bankAccount.entity.id.value,
      },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit card with one name already exists for that same user", async () => {
    const anotherCreditCard = makeCreditCard({
      userId,
      bankAccountId: bankAccount.entity.id.value,
    });

    await creditCardRepository.create(anotherCreditCard.entity);

    const sameNameOfOwnCreditCardResult = await sut.execute<"success">({
      userId,
      creditCardId: creditCard.entity.id.value,
      data: { name: creditCard.entity.name.value },
    });
    const sameNameOfAnotherCreditCardResult = await sut.execute<"error">({
      userId,
      creditCardId: creditCard.entity.id.value,
      data: { name: anotherCreditCard.entity.name.value },
    });

    expect(sameNameOfOwnCreditCardResult.isRight()).toBeTruthy();
    expect(sameNameOfAnotherCreditCardResult.isLeft()).toBeTruthy();
    expect(sameNameOfAnotherCreditCardResult.reason).toBeInstanceOf(
      ResourceAlreadyExistsError,
    );
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a credit card without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        creditCardId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a credit card without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        creditCardId: creditCard.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a credit card with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        bankAccountId: bankAccount.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          userId: faker.string.uuid(),
          slug: faker.lorem.sentence(),
          inactivatedAt: faker.date.recent(),
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
