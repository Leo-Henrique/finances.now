import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeCreditCard } from "test/factories/make-credit-card";
import { makeCreditExpenseTransaction } from "test/factories/make-credit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { InMemoryCreditExpenseTransactionRepository } from "test/repositories/in-memory-credit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateCreditExpenseTransactionUseCase } from "./create-credit-expense-transaction.use-case";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let creditCardRepository: InMemoryCreditCardRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let creditExpenseTransactionRepository: InMemoryCreditExpenseTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;
let unitOfWork: FakeUnitOfWork;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: CreateCreditExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let creditCard: ReturnType<typeof makeCreditCard>;
let creditExpenseTransaction: ReturnType<typeof makeCreditExpenseTransaction>;

describe("[Use Case] Create credit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    creditCardRepository = new InMemoryCreditCardRepository({
      bankAccountRepository,
    });
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    creditExpenseTransactionRepository =
      new InMemoryCreditExpenseTransactionRepository({ creditCardRepository });
    jobSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        transactionRecurrenceRepository: creditExpenseTransactionRepository,
        jobSchedulingService,
        unitOfWork,
      },
    );

    sut = new CreateCreditExpenseTransactionUseCase({
      creditCardRepository,
      transactionCategoryRepository,
      creditExpenseTransactionRepository,
      jobSchedulingService,
      unitOfWork,
      createTransactionRecurrenceUseCase,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });
    creditCard = makeCreditCard({ bankAccountId: bankAccount.entity.id.value });

    const [transactionCategory] =
      await transactionCategoryRepository.findManyFromUserOfExpenses(userId);

    creditExpenseTransaction = makeCreditExpenseTransaction({
      creditCardId: creditCard.entity.id.value,
      categoryId: transactionCategory.id.value,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await creditCardRepository.create(creditCard.entity);
  });

  it("should be able to create a credit expense transaction", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...creditExpenseTransaction.input,
    });

    expect(isRight()).toBeTruthy();
    expect(result.creditExpenseTransaction.creditCardId).toEqual(
      creditExpenseTransaction.entity.creditCardId,
    );
    expect(creditExpenseTransactionRepository.items[0]).toEqual(
      result.creditExpenseTransaction,
    );
  });

  it("should be able to create a credit expense transaction that will be carried out in the future", async () => {
    const daysToFirstTransactionOccur = 2;
    const transactedAt = new Date(
      new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
    );

    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...creditExpenseTransaction.input,
      transactedAt,
    });

    expect(isRight()).toBeTruthy();
    expect(creditExpenseTransactionRepository.items[0]).toEqual(
      result.creditExpenseTransaction,
    );

    const transactionDateInStartOfDay = new Date(
      transactedAt.getFullYear(),
      transactedAt.getMonth(),
      transactedAt.getDate(),
    );

    expect(creditExpenseTransactionRepository.items[0].transactedAt).toEqual(
      transactionDateInStartOfDay,
    );
  });

  it("should not be able to create a credit expense transaction for non-existent credit card", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
      creditCardId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit expense transaction for non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
      categoryId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit expense transaction with a credit card that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });
    const creditCardFromAnotherUser = makeCreditCard({
      bankAccountId: bankAccountFromAnotherUser.entity.id.value,
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);
    await creditCardRepository.create(creditCardFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
      creditCardId: creditCardFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit expense transaction with a transaction category that does not belong to the user", async () => {
    const transactionCategoryFromAnotherUser = makeTransactionCategory({
      userId: faker.string.uuid(),
    });

    await transactionCategoryRepository.create(
      transactionCategoryFromAnotherUser.entity,
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
      categoryId: transactionCategoryFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit expense transaction with a credit card inactivated", async () => {
    await creditCardRepository.update(creditCard.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a credit expense transaction with a bank account from credit card inactivated", async () => {
    await bankAccountRepository.update(bankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...creditExpenseTransaction.input,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should be able to create a credit expense transaction without optional input fields", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        ...creditExpenseTransaction.input,
      });

      expect(isRight()).toBeTruthy();
    });

    it("should not be able to create a credit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...creditExpenseTransaction.input,
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        creditCardId: undefined,
        // @ts-expect-error: field is required
        categoryId: undefined,
        // @ts-expect-error: field is required
        amount: undefined,
        // @ts-expect-error: field is required
        transactedAt: undefined,
        // @ts-expect-error: field is required
        description: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit expense transaction with invalid amount", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...creditExpenseTransaction.input,
        amount: -50,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit expense transaction with invalid description", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...creditExpenseTransaction.input,
        description: faker.string.alphanumeric({
          length: { min: 256, max: 300 },
        }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a credit expense transaction with invalid recurrence", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...creditExpenseTransaction.input,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
