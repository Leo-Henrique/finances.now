import { InferResultOfEither } from "@/core/either";
import { ValidationError } from "@/core/errors/errors";
import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import {
  InMemoryEarningTransactionRepository,
  recurrenceLimitDefaultPart,
} from "test/repositories/in-memory-earning-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { millisecondsRemainingForDateByPeriod } from "test/utils/milliseconds-remaining-for-date-by-period";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreateEarningTransactionUseCase,
  CreateEarningTransactionUseCaseOutput,
} from "./create-earning-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;
let unitOfWork: FakeUnitOfWork;

let sut: CreateEarningTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let earningTransaction: ReturnType<typeof makeEarningTransaction>;

describe("[Use Case] Create earning transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    earningTransactionRepository = new InMemoryEarningTransactionRepository();
    jobSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateEarningTransactionUseCase({
      bankAccountRepository,
      transactionCategoryRepository,
      earningTransactionRepository,
      jobSchedulingService,
      unitOfWork,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    const [transactionCategory] =
      await transactionCategoryRepository.findManyFromUserOfEarning(userId);

    earningTransaction = makeEarningTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: transactionCategory.id.value,
    });

    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to create a earning transaction", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...earningTransaction.input,
    });

    expect(isRight()).toBeTruthy();
    expect(result.earningTransaction.bankAccountId).toEqual(
      earningTransaction.entity.bankAccountId,
    );
    expect(earningTransactionRepository.items[0]).toEqual(
      result.earningTransaction,
    );
  });

  it("should be able to sum bank account balance with amount transaction", async () => {
    const userBalance = bankAccountRepository.items[0].balance;
    const amount = 50;
    const { isRight } = await sut.execute<"success">({
      userId,
      ...earningTransaction.input,
      amount,
      transactedAt: faker.date.recent(),
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      userBalance + amount,
    );
  });

  it("should not be able to create a earning transaction for non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...earningTransaction.input,
      bankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a earning transaction for non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...earningTransaction.input,
      categoryId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a earning transaction with a bank account that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...earningTransaction.input,
      bankAccountId: bankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a earning transaction with a transaction category that does not belong to the user", async () => {
    const transactionCategoryFromAnotherUser = makeTransactionCategory({
      userId: faker.string.uuid(),
    });

    await transactionCategoryRepository.create(
      transactionCategoryFromAnotherUser.entity,
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...earningTransaction.input,
      categoryId: transactionCategoryFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a earning transaction with a bank account inactivated", async () => {
    await bankAccountRepository.update(bankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...earningTransaction.input,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] transaction scheduling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should be able to create a transaction that will be carried out in the future", async () => {
      const daysToFirstTransactionOccur = 2;
      const amount = 50;
      const transactedAt = new Date(
        new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
      );
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
        amount,
        transactedAt,
      });

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items[0]).toEqual(
        result.earningTransaction,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(oldBalance);

      const transactionDateInStartOfDay = new Date(
        transactedAt.getFullYear(),
        transactedAt.getMonth(),
        transactedAt.getDate(),
      );

      expect(earningTransactionRepository.items[0].transactedAt).toEqual(
        transactionDateInStartOfDay,
      );

      vi.advanceTimersByTime(
        millisecondsRemainingForDateByPeriod(
          daysToFirstTransactionOccur,
          "day",
        ),
      );
      await new Promise(process.nextTick);

      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance + amount,
      );
    });

    it("should be able to create recurring transaction", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
        amount,
        recurrencePeriod: "day",
      });
      const countTransactionsAddedAtTime = recurrenceLimitDefaultPart;

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items[0]).toEqual(
        result.earningTransaction,
      );
      expect(earningTransactionRepository.items).toHaveLength(
        countTransactionsAddedAtTime + 1,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance + amount,
      );

      const originTransaction = earningTransactionRepository.items[0];

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
            earningTransactionRepository.items[transactionIndex];

          expect(transaction.originId).toEqual(originTransaction.id);
          expect(transaction.bankAccountId).toEqual(
            originTransaction.bankAccountId,
          );
          expect(transaction.categoryId).toEqual(originTransaction.categoryId);
          expect(transaction.amount).toEqual(originTransaction.amount);
          expect(transaction.description).toEqual(
            originTransaction.description,
          );
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
        const countTransactions = earningTransactionRepository.items.length;
        const factorIndex = countTransactionsAddedAtTime / 2 + 1;
        const transaction =
          earningTransactionRepository.items[countTransactions - factorIndex];

        return transaction.transactedAt;
      };

      for (
        let transactionsPart = 1;
        transactionsPart <= 3;
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
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items[0]).toEqual(
        result.earningTransaction,
      );
      expect(earningTransactionRepository.items).toHaveLength(
        recurrenceLimit + 1,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance + amount,
      );

      const originTransaction = earningTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

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
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight, result } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
        amount,
        recurrencePeriod: "day",
        recurrenceLimit,
        recurrenceAmount,
      });

      expect(earningTransactionRepository.items[0]).toEqual(
        result.earningTransaction,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance + amount,
      );

      const originTransaction = earningTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

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

    it("should be able to repeat update bank account balance in recurrence period", async () => {
      const recurrenceLimit = 10;
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();
      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance + amount,
      );

      let lastBalance = oldBalance;

      for (
        let currentTransaction = 2;
        currentTransaction <= recurrenceLimit + 1;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(
          millisecondsRemainingForDateByPeriod(1, "month"),
        );
        await new Promise(process.nextTick);

        lastBalance = oldBalance + amount * currentTransaction;

        expect(bankAccountRepository.items[0].balance).toEqual(lastBalance);
      }

      vi.advanceTimersByTime(millisecondsRemainingForDateByPeriod(1, "month"));
      await new Promise(process.nextTick);

      expect(bankAccountRepository.items[0].balance).toEqual(lastBalance);
    });

    it("should not be able to schedule bank account balance update when database transaction error occurs", async () => {
      type Result = InferResultOfEither<
        CreateEarningTransactionUseCaseOutput,
        "error"
      >;

      const { isLeft, reason } = (await sut["handle"]({
        userId,
        ...earningTransaction.input,
        transactedAt: new Date(new Date().getTime() + dayInMilliseconds(1)),
        amount: 50,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.words(1),
      })) as Result;

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(FailedToCreateTransactionError);
      expect(jobSchedulingService.items).toHaveLength(0);
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should be able to create a earning transaction without optional input fields", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        ...earningTransaction.input,
      });

      expect(isRight()).toBeTruthy();
    });

    it("should not be able to create a earning transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...earningTransaction.input,
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

    it("should not be able to create a earning transaction with invalid amount", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...earningTransaction.input,
        amount: -50,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a earning transaction with invalid description", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...earningTransaction.input,
        description: faker.string.alphanumeric({
          length: { min: 256, max: 300 },
        }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a earning transaction with invalid recurrence", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...earningTransaction.input,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
