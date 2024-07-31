import { faker } from "@faker-js/faker";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import {
  IN_MEMORY_COUNT_BATCH_EARNING_TRANSACTIONS_IN_RECURRENCE,
  InMemoryEarningTransactionRepository,
} from "test/repositories/in-memory-earning-transaction.repository";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let jobScheduling: InMemoryJobScheduling;
let unitOfWork: FakeUnitOfWork;

let sut: CreateTransactionRecurrenceUseCase;

describe("[Use Case] Create transaction recurrence", () => {
  beforeEach(async () => {
    earningTransactionRepository = new InMemoryEarningTransactionRepository({
      bankAccountRepository,
    });
    jobScheduling = new InMemoryJobScheduling();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateTransactionRecurrenceUseCase({
      transactionRecurrenceRepository: earningTransactionRepository,
      jobScheduling,
      unitOfWork,
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
      applyTransaction: false,
    });

    expect(isRight()).toBeTruthy();
    expect(earningTransactionRepository.items).toHaveLength(
      IN_MEMORY_COUNT_BATCH_EARNING_TRANSACTIONS_IN_RECURRENCE,
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
      const factorIndex =
        IN_MEMORY_COUNT_BATCH_EARNING_TRANSACTIONS_IN_RECURRENCE / 2 + 1;
      const transaction =
        earningTransactionRepository.items[countTransactions - factorIndex];

      return transaction.transactedAt;
    };

    for (let transactionsPart = 1; transactionsPart <= 5; transactionsPart++) {
      vi.advanceTimersByTime(
        millisecondsRemainingForDate(getMiddleRecurringTransactedDate()),
      );
      await new Promise(process.nextTick);

      const currentPart =
        IN_MEMORY_COUNT_BATCH_EARNING_TRANSACTIONS_IN_RECURRENCE *
        transactionsPart;

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
      applyTransaction: false,
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
      applyTransaction: false,
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
