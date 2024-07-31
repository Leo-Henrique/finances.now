import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryDebitExpenseTransactionRepository } from "test/repositories/in-memory-debit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateDebitExpenseTransactionUseCase } from "./create-debit-expense-transaction.use-case";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let jobScheduling: InMemoryJobScheduling;
let unitOfWork: FakeUnitOfWork;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: CreateDebitExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let debitExpenseTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

describe("[Use Case] Create debit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    debitExpenseTransactionRepository =
      new InMemoryDebitExpenseTransactionRepository({ bankAccountRepository });
    jobScheduling = new InMemoryJobScheduling();
    unitOfWork = new FakeUnitOfWork();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        transactionRecurrenceRepository: debitExpenseTransactionRepository,
        jobScheduling,
        unitOfWork,
      },
    );

    sut = new CreateDebitExpenseTransactionUseCase({
      bankAccountRepository,
      transactionCategoryRepository,
      debitExpenseTransactionRepository,
      jobScheduling,
      unitOfWork,
      createTransactionRecurrenceUseCase,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    const [transactionCategory] =
      await transactionCategoryRepository.findManyFromUserOfExpenses(userId);

    debitExpenseTransaction = makeDebitExpenseTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: transactionCategory.id.value,
    });

    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to create a debit expense transaction", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...debitExpenseTransaction.input,
    });

    expect(isRight()).toBeTruthy();
    expect(result.debitExpenseTransaction.bankAccountId).toEqual(
      debitExpenseTransaction.entity.bankAccountId,
    );
    expect(debitExpenseTransactionRepository.items[0]).toEqual(
      result.debitExpenseTransaction,
    );
  });

  it("should be able to create a debit expense transaction that will be carried out in the future", async () => {
    const daysToFirstTransactionOccur = 2;
    const transactedAt = new Date(
      new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
    );

    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...debitExpenseTransaction.input,
      transactedAt,
    });

    expect(isRight()).toBeTruthy();
    expect(debitExpenseTransactionRepository.items[0]).toEqual(
      result.debitExpenseTransaction,
    );

    const transactionDateInStartOfDay = new Date(
      transactedAt.getFullYear(),
      transactedAt.getMonth(),
      transactedAt.getDate(),
    );

    expect(debitExpenseTransactionRepository.items[0].transactedAt).toEqual(
      transactionDateInStartOfDay,
    );
  });

  it("should be able to accomplish transaction when has been marked if paid", async () => {
    const bankAccountBalance = bankAccountRepository.items[0].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...debitExpenseTransaction.input,
      amount,
      isAccomplished: true,
    });

    expect(isRight()).toBeTruthy();
    expect(
      debitExpenseTransactionRepository.items[0].isAccomplished,
    ).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccountBalance - amount,
    );
  });

  it("should not be able to accomplish transaction when has been not marked if paid", async () => {
    const bankAccountBalance = bankAccountRepository.items[0].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...debitExpenseTransaction.input,
      amount,
      isAccomplished: false,
    });

    expect(isRight()).toBeTruthy();
    expect(
      debitExpenseTransactionRepository.items[0].isAccomplished,
    ).toBeFalsy();
    expect(bankAccountRepository.items[0].balance).toEqual(bankAccountBalance);
  });

  it("should not be able to create a debit expense transaction for non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...debitExpenseTransaction.input,
      bankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a debit expense transaction for non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...debitExpenseTransaction.input,
      categoryId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a debit expense transaction with a bank account that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...debitExpenseTransaction.input,
      bankAccountId: bankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a debit expense transaction with a transaction category that does not belong to the user", async () => {
    const transactionCategoryFromAnotherUser = makeTransactionCategory({
      userId: faker.string.uuid(),
    });

    await transactionCategoryRepository.create(
      transactionCategoryFromAnotherUser.entity,
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...debitExpenseTransaction.input,
      categoryId: transactionCategoryFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a debit expense transaction with a bank account inactivated", async () => {
    await bankAccountRepository.update(bankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...debitExpenseTransaction.input,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should be able to create a debit expense transaction without optional input fields", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
      });

      expect(isRight()).toBeTruthy();
    });

    it("should not be able to create a debit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...debitExpenseTransaction.input,
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        bankAccountId: undefined,
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

    it("should not be able to create a debit expense transaction with invalid amount", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...debitExpenseTransaction.input,
        amount: -50,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a debit expense transaction with invalid description", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...debitExpenseTransaction.input,
        description: faker.string.alphanumeric({
          length: { min: 256, max: 300 },
        }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a debit expense transaction with invalid recurrence", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...debitExpenseTransaction.input,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
