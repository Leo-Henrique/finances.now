import { ValidationError } from "@/core/errors/errors";
import { Slug } from "@/domain/entities/value-objects/slug";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeCreditCard } from "test/factories/make-credit-card";
import { makeUser } from "test/factories/make-user";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateCreditCardUseCase } from "./create-credit-card.use-case";

let userRepository: InMemoryUserRepository;
let bankAccountRepository: InMemoryBankAccountRepository;
let creditCardRepository: InMemoryCreditCardRepository;
let sut: CreateCreditCardUseCase;
let user: ReturnType<typeof makeUser>;
let bankAccount: ReturnType<typeof makeBankAccount>;
let creditCard: ReturnType<typeof makeCreditCard>;

describe("[Use Case] Create credit card", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    bankAccountRepository = new InMemoryBankAccountRepository();
    creditCardRepository = new InMemoryCreditCardRepository();
    sut = new CreateCreditCardUseCase({
      userRepository,
      bankAccountRepository,
      creditCardRepository,
    });
    user = makeUser();
    bankAccount = makeBankAccount({ userId: user.entity.id.value });
    creditCard = makeCreditCard({
      userId: user.entity.id.value,
      bankAccountId: bankAccount.entity.id.value,
    });

    await userRepository.create(user.entity);
    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to create a credit card", async () => {
    const { isRight, result } = await sut.execute<"success">(creditCard.input);

    expect(isRight()).toBeTruthy();
    expect(result.creditCard.userId.value).toEqual(creditCard.input.userId);
    expect(result.creditCard.bankAccountId.value).toEqual(
      creditCard.input.bankAccountId,
    );
    expect(result.creditCard.slug).toBeInstanceOf(Slug);
    expect(creditCardRepository.items[0]).toEqual(result.creditCard);
  });

  it("should not be able to create a credit card for non-existent user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...creditCard.input,
      userId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit card for non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...creditCard.input,
      bankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit card with a bank account that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      ...creditCard.input,
      bankAccountId: bankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit card with a bank account inactivated", async () => {
    await bankAccountRepository.update(bankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">(creditCard.input);

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit card with one name already exists for that same user", async () => {
    await creditCardRepository.create(creditCard.entity);

    const { isLeft, reason } = await sut.execute<"error">(creditCard.input);

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceAlreadyExistsError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should be able to create a credit card without optional input fields", async () => {
      const { isRight, result } = await sut.execute<"success">({
        ...creditCard.input,
        description: undefined,
        mainCard: undefined,
      });

      expect(isRight()).toBeTruthy();
      expect(result.creditCard.description).toBeNull();
      expect(result.creditCard.mainCard).toEqual(false);
    });

    it("should not be able to create a credit card without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...bankAccount.input,
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        bankAccountId: undefined,
        // @ts-expect-error: field is required
        name: undefined,
        // @ts-expect-error: field is required
        limit: undefined,
        // @ts-expect-error: field is required
        invoiceClosingDay: undefined,
        // @ts-expect-error: field is required
        invoiceDueDay: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit card with invalid limit", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...creditCard.input,
        limit: -50,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit card with invalid invoice closing day", async () => {
      const dayZeroResult = await sut.execute<"error">({
        ...creditCard.input,
        invoiceClosingDay: 0,
      });
      const dayThirtyTwoResult = await sut.execute<"error">({
        ...creditCard.input,
        invoiceClosingDay: 32,
      });

      expect(dayZeroResult.isLeft()).toBeTruthy();
      expect(dayZeroResult.reason).toBeInstanceOf(ValidationError);
      expect(dayThirtyTwoResult.isLeft()).toBeTruthy();
      expect(dayThirtyTwoResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit card with invalid invoice due day", async () => {
      const dayZeroResult = await sut.execute<"error">({
        ...creditCard.input,
        invoiceDueDay: 0,
      });
      const dayThirtyTwoResult = await sut.execute<"error">({
        ...creditCard.input,
        invoiceDueDay: 32,
      });

      expect(dayZeroResult.isLeft()).toBeTruthy();
      expect(dayZeroResult.reason).toBeInstanceOf(ValidationError);
      expect(dayThirtyTwoResult.isLeft()).toBeTruthy();
      expect(dayThirtyTwoResult.reason).toBeInstanceOf(ValidationError);
    });
  });
});
