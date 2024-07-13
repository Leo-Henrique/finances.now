import { faker } from "@faker-js/faker";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import {
  InMemoryEarningTransactionRepository,
  earningTransactionsNumberPerTimeInRecurrence,
} from "test/repositories/in-memory-earning-transaction.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;

let sut: CreateTransactionRecurrenceUseCase;

describe("[Use Case] Create transaction recurrence", () => {
  beforeEach(async () => {
    earningTransactionRepository = new InMemoryEarningTransactionRepository({
      bankAccountRepository,
    });
    jobSchedulingService = new InMemoryJobSchedulingService();

    sut = new CreateTransactionRecurrenceUseCase({
      transactionRecurrenceRepository: earningTransactionRepository,
      jobSchedulingService,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should be able to create recurring transaction", async () => {
    const originTransaction = makeEarningTransaction({
      bankAccountId: faker.string.uuid(),
      categoryId: faker.string.uuid(),
      recurrencePeriod: "day",
    });

    const { isRight } = await sut.execute<"success">({
      originTransaction: originTransaction.entity,
    });

    const countTransactionsAddedAtTime =
      earningTransactionsNumberPerTimeInRecurrence;

    expect(isRight()).toBeTruthy();
    expect(earningTransactionRepository.items).toHaveLength(
      countTransactionsAddedAtTime,
    );

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

        expect(transaction.id).not.toEqual(originTransaction.entity.id);
        expect(transaction.originId).toEqual(originTransaction.entity.id);
        expect(transaction.bankAccountId).toEqual(
          originTransaction.entity.bankAccountId,
        );
        expect(transaction.categoryId).toEqual(
          originTransaction.entity.categoryId,
        );
        expect(transaction.amount).toEqual(originTransaction.entity.amount);
        expect(transaction.description).toEqual(
          originTransaction.entity.description,
        );
        expect(transaction.isAccomplished).toBeFalsy();
        expect(transaction.recurrencePeriod).toBeNull();
        expect(transaction.recurrenceLimit).toBeNull();
        expect(transaction.recurrenceAmount).toBeNull();

        const transactionDate = new Date(
          originTransaction.entity.transactedAt.getFullYear(),
          originTransaction.entity.transactedAt.getMonth(),
          originTransaction.entity.transactedAt.getDate() +
            transactionIndex +
            1,
        );

        expect(transaction.transactedAt).toEqual(transactionDate);
      }
    };

    expectedOfRecurringTransactions(0, 10);

    const getMiddleRecurringTransactedDate = () => {
      const countTransactions = earningTransactionRepository.items.length;
      const factorIndex = countTransactionsAddedAtTime / 2 + 1;
      const transaction =
        earningTransactionRepository.items[countTransactions - factorIndex];

      return transaction.transactedAt;
    };

    for (let transactionsPart = 1; transactionsPart <= 5; transactionsPart++) {
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

    const originTransaction = makeEarningTransaction({
      bankAccountId: faker.string.uuid(),
      categoryId: faker.string.uuid(),
      recurrencePeriod: "month",
      recurrenceLimit,
    });

    const { isRight } = await sut.execute<"success">({
      originTransaction: originTransaction.entity,
    });

    expect(isRight()).toBeTruthy();
    expect(earningTransactionRepository.items).toHaveLength(recurrenceLimit);

    for (
      let transactionIndex = 0;
      transactionIndex < recurrenceLimit;
      transactionIndex++
    ) {
      const transaction = earningTransactionRepository.items[transactionIndex];

      const transactionDate = new Date(
        originTransaction.entity.transactedAt.getFullYear(),
        originTransaction.entity.transactedAt.getMonth() + transactionIndex + 1,
        originTransaction.entity.transactedAt.getDate(),
      );

      expect(transaction.transactedAt).toEqual(transactionDate);
    }
  });

  it("should be able to create recurring transaction with a personalized period", async () => {
    const recurrenceAmount = 3;
    const recurrenceLimit = 10;

    const originTransaction = makeEarningTransaction({
      bankAccountId: faker.string.uuid(),
      categoryId: faker.string.uuid(),
      recurrencePeriod: "day",
      recurrenceLimit,
      recurrenceAmount,
    });

    const { isRight } = await sut.execute<"success">({
      originTransaction: originTransaction.entity,
    });

    expect(isRight()).toBeTruthy();

    for (
      let transactionIndex = 0;
      transactionIndex < recurrenceLimit;
      transactionIndex++
    ) {
      const transaction = earningTransactionRepository.items[transactionIndex];

      const transactionDate = new Date(
        originTransaction.entity.transactedAt.getFullYear(),
        originTransaction.entity.transactedAt.getMonth(),
        originTransaction.entity.transactedAt.getDate() +
          recurrenceAmount * (transactionIndex + 1),
      );

      expect(transaction.transactedAt).toEqual(transactionDate);
    }
  });
});
