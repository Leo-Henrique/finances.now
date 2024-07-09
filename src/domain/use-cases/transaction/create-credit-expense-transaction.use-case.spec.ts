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
import {
  InMemoryCreditExpenseTransactionRepository,
  creditExpenseTransactionsNumberPerTimeInRecurrence,
} from "test/repositories/in-memory-credit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateCreditExpenseTransactionUseCase } from "./create-credit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let creditCardRepository: InMemoryCreditCardRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let creditExpenseTransactionRepository: InMemoryCreditExpenseTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;
let unitOfWork: FakeUnitOfWork;

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
      new InMemoryCreditExpenseTransactionRepository();
    jobSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateCreditExpenseTransactionUseCase({
      creditCardRepository,
      transactionCategoryRepository,
      creditExpenseTransactionRepository,
      jobSchedulingService,
      unitOfWork,
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
        ...creditExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
      });
      const countTransactionsAddedAtTime =
        creditExpenseTransactionsNumberPerTimeInRecurrence;

      expect(isRight()).toBeTruthy();
      expect(creditExpenseTransactionRepository.items[0]).toEqual(
        result.creditExpenseTransaction,
      );
      expect(
        creditExpenseTransactionRepository.items[0].recurrenceAmount,
      ).toEqual(1);
      expect(creditExpenseTransactionRepository.items).toHaveLength(
        countTransactionsAddedAtTime + 1,
      );

      const originTransaction = creditExpenseTransactionRepository.items[0];

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
            creditExpenseTransactionRepository.items[transactionIndex];

          expect(transaction.id).not.toEqual(originTransaction.id);
          expect(transaction.originId).toEqual(originTransaction.id);
          expect(transaction.creditCardId).toEqual(
            originTransaction.creditCardId,
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
          creditExpenseTransactionRepository.items.length;
        const factorIndex = countTransactionsAddedAtTime / 2 + 1;
        const transaction =
          creditExpenseTransactionRepository.items[
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
        ...creditExpenseTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();
      expect(creditExpenseTransactionRepository.items[0]).toEqual(
        result.creditExpenseTransaction,
      );
      expect(creditExpenseTransactionRepository.items).toHaveLength(
        recurrenceLimit + 1,
      );

      const originTransaction = creditExpenseTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

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
        ...creditExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
        recurrenceLimit,
        recurrenceAmount,
      });

      expect(creditExpenseTransactionRepository.items[0]).toEqual(
        result.creditExpenseTransaction,
      );
      expect(
        creditExpenseTransactionRepository.items[0].recurrenceAmount,
      ).toEqual(recurrenceAmount);

      const originTransaction = creditExpenseTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

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
