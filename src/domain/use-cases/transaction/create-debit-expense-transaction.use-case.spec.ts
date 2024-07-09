import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import {
  InMemoryDebitExpenseTransactionRepository,
  debitExpenseTransactionsNumberPerTimeInRecurrence,
} from "test/repositories/in-memory-debit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateDebitExpenseTransactionUseCase } from "./create-debit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;
let unitOfWork: FakeUnitOfWork;

let sut: CreateDebitExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let debitExpenseTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

describe("[Use Case] Create debit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    debitExpenseTransactionRepository =
      new InMemoryDebitExpenseTransactionRepository();
    jobSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateDebitExpenseTransactionUseCase({
      bankAccountRepository,
      transactionCategoryRepository,
      debitExpenseTransactionRepository,
      jobSchedulingService,
      unitOfWork,
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

  describe("[Business Roles] recurring transaction", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should be able to create recurring transaction", async () => {
      const amount = 50;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
      });
      const countTransactionsAddedAtTime =
        debitExpenseTransactionsNumberPerTimeInRecurrence;

      expect(isRight()).toBeTruthy();
      expect(debitExpenseTransactionRepository.items[0]).toEqual(
        result.debitExpenseTransaction,
      );
      expect(debitExpenseTransactionRepository.items).toHaveLength(
        countTransactionsAddedAtTime + 1,
      );

      const originTransaction = debitExpenseTransactionRepository.items[0];

      const expectedOfRecurringTransactions = (
        firstIndex: number,
        lastIndex: number,
      ) => {
        for (
          let transactionIndex = firstIndex;
          transactionIndex <= lastIndex;
          transactionIndex++
        ) {
          const transaction =
            debitExpenseTransactionRepository.items[transactionIndex];

          expect(transaction.id).not.toEqual(originTransaction.id);
          expect(transaction.originId).toEqual(originTransaction.id);
          expect(transaction.bankAccountId).toEqual(
            originTransaction.bankAccountId,
          );
          expect(transaction.categoryId).toEqual(originTransaction.categoryId);
          expect(transaction.amount).toEqual(originTransaction.amount);
          expect(transaction.description).toEqual(
            originTransaction.description,
          );
          expect(transaction.isAccomplished).toBeFalsy();
          expect(transaction.recurrencePeriod).toBeNull();
          expect(transaction.recurrenceLimit).toBeNull();
          expect(transaction.recurrenceAmount).toBeNull();

          const transactionDate = new Date(
            originTransaction.transactedAt.getFullYear(),
            originTransaction.transactedAt.getMonth(),
            originTransaction.transactedAt.getDate() + transactionIndex,
          );

          expect(transaction.transactedAt).toEqual(transactionDate);
        }
      };

      expectedOfRecurringTransactions(1, 10);

      const getMiddleRecurringTransactedDate = () => {
        const countTransactions =
          debitExpenseTransactionRepository.items.length;
        const factorIndex = countTransactionsAddedAtTime / 2 + 1;
        const transaction =
          debitExpenseTransactionRepository.items[
            countTransactions - factorIndex
          ];

        return transaction.transactedAt;
      };

      for (
        let transactionsPart = 1;
        transactionsPart <= 5;
        transactionsPart++
      ) {
        vi.advanceTimersByTime(
          millisecondsRemainingForDate(getMiddleRecurringTransactedDate()),
        );
        await new Promise(process.nextTick);

        const currentPart = countTransactionsAddedAtTime * transactionsPart;

        expectedOfRecurringTransactions(currentPart, currentPart + 30);
      }
    });

    it("should be able to create recurring transaction with a limit", async () => {
      const recurrenceLimit = 10;
      const amount = 50;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();
      expect(debitExpenseTransactionRepository.items[0]).toEqual(
        result.debitExpenseTransaction,
      );
      expect(debitExpenseTransactionRepository.items).toHaveLength(
        recurrenceLimit + 1,
      );

      const originTransaction = debitExpenseTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        const transactionDate = new Date(
          originTransaction.transactedAt.getFullYear(),
          originTransaction.transactedAt.getMonth() + transactionIndex,
          originTransaction.transactedAt.getDate(),
        );

        expect(transaction.transactedAt).toEqual(transactionDate);
      }
    });

    it("should be able to create recurring transaction with a personalized period", async () => {
      const recurrenceAmount = 3;
      const recurrenceLimit = 10;
      const amount = 50;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
        recurrenceLimit,
        recurrenceAmount,
      });

      expect(debitExpenseTransactionRepository.items[0]).toEqual(
        result.debitExpenseTransaction,
      );

      const originTransaction = debitExpenseTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        const transactionDate = new Date(
          originTransaction.transactedAt.getFullYear(),
          originTransaction.transactedAt.getMonth(),
          originTransaction.transactedAt.getDate() +
            recurrenceAmount * transactionIndex,
        );

        expect(transaction.transactedAt).toEqual(transactionDate);
      }

      expect(isRight()).toBeTruthy();
    });
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
