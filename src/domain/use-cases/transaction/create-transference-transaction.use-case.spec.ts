import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";

import {
  InMemoryTransferenceTransactionRepository,
  transferenceTransactionsNumberPerTimeInRecurrence,
} from "test/repositories/in-memory-transference-transaction.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDate } from "test/utils/milliseconds-remaining-for-date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTransferenceTransactionUseCase } from "./create-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let jobSchedulingService: InMemoryJobSchedulingService;
let unitOfWork: FakeUnitOfWork;

let sut: CreateTransferenceTransactionUseCase;

let userId: string;
let originBankAccount: ReturnType<typeof makeBankAccount>;
let destinyBankAccount: ReturnType<typeof makeBankAccount>;
let transferenceTransaction: ReturnType<typeof makeTransferenceTransaction>;

describe("[Use Case] Create transference transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transferenceTransactionRepository =
      new InMemoryTransferenceTransactionRepository({ bankAccountRepository });
    jobSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateTransferenceTransactionUseCase({
      bankAccountRepository,
      transferenceTransactionRepository,
      jobSchedulingService,
      unitOfWork,
    });

    userId = faker.string.uuid();
    originBankAccount = makeBankAccount({ userId });
    destinyBankAccount = makeBankAccount({ userId });

    transferenceTransaction = makeTransferenceTransaction({
      originBankAccountId: originBankAccount.entity.id.value,
      destinyBankAccountId: destinyBankAccount.entity.id.value,
    });

    await bankAccountRepository.create(originBankAccount.entity);
    await bankAccountRepository.create(destinyBankAccount.entity);
  });

  it("should be able to create a transference transaction", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transferenceTransaction.originBankAccountId).toEqual(
      transferenceTransaction.entity.originBankAccountId,
    );
    expect(result.transferenceTransaction.destinyBankAccountId).toEqual(
      transferenceTransaction.entity.destinyBankAccountId,
    );
    expect(transferenceTransactionRepository.items[0]).toEqual(
      result.transferenceTransaction,
    );
  });

  it("should be able to create a transference transaction that will be carried out in the future", async () => {
    const daysToFirstTransactionOccur = 2;
    const transactedAt = new Date(
      new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
    );

    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      transactedAt,
    });

    expect(isRight()).toBeTruthy();
    expect(transferenceTransactionRepository.items[0]).toEqual(
      result.transferenceTransaction,
    );

    const transactionDateInStartOfDay = new Date(
      transactedAt.getFullYear(),
      transactedAt.getMonth(),
      transactedAt.getDate(),
    );

    expect(transferenceTransactionRepository.items[0].transactedAt).toEqual(
      transactionDateInStartOfDay,
    );
  });

  it("should be able to accomplish transaction when has been marked if paid", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      amount,
      isAccomplished: true,
    });

    expect(isRight()).toBeTruthy();
    expect(
      transferenceTransactionRepository.items[0].isAccomplished,
    ).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance - amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance + amount,
    );
  });

  it("should not be able to accomplish transaction when has been not marked if transferred", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      amount,
      isAccomplished: false,
    });

    expect(isRight()).toBeTruthy();
    expect(
      transferenceTransactionRepository.items[0].isAccomplished,
    ).toBeFalsy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance,
    );
  });

  it("should not be able to create a transference transaction for non-existent origin bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      originBankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction for non-existent destiny bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      destinyBankAccountId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a origin bank account that does not belong to the user", async () => {
    const originBankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(originBankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      originBankAccountId: originBankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a destiny bank account that does not belong to the user", async () => {
    const destinyBankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(
      destinyBankAccountFromAnotherUser.entity,
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      destinyBankAccountId: destinyBankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a origin bank account inactivated", async () => {
    await bankAccountRepository.update(originBankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a destiny bank account inactivated", async () => {
    await bankAccountRepository.update(destinyBankAccount.entity, {
      inactivatedAt: new Date(),
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
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
        ...transferenceTransaction.input,
        amount,
        recurrencePeriod: "day",
      });
      const countTransactionsAddedAtTime =
        transferenceTransactionsNumberPerTimeInRecurrence;

      expect(isRight()).toBeTruthy();
      expect(transferenceTransactionRepository.items[0]).toEqual(
        result.transferenceTransaction,
      );
      expect(
        transferenceTransactionRepository.items[0].recurrenceAmount,
      ).toEqual(1);
      expect(transferenceTransactionRepository.items).toHaveLength(
        countTransactionsAddedAtTime + 1,
      );

      const originTransaction = transferenceTransactionRepository.items[0];

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
            transferenceTransactionRepository.items[transactionIndex];

          expect(transaction.id).not.toEqual(originTransaction.id);
          expect(transaction.originId).toEqual(originTransaction.id);
          expect(transaction.originBankAccountId).toEqual(
            originTransaction.originBankAccountId,
          );
          expect(transaction.destinyBankAccountId).toEqual(
            originTransaction.destinyBankAccountId,
          );
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
          transferenceTransactionRepository.items.length;
        const factorIndex = countTransactionsAddedAtTime / 2 + 1;
        const transaction =
          transferenceTransactionRepository.items[
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
        ...transferenceTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();
      expect(transferenceTransactionRepository.items[0]).toEqual(
        result.transferenceTransaction,
      );
      expect(transferenceTransactionRepository.items).toHaveLength(
        recurrenceLimit + 1,
      );

      const originTransaction = transferenceTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

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
        ...transferenceTransaction.input,
        amount,
        recurrencePeriod: "day",
        recurrenceLimit,
        recurrenceAmount,
      });

      expect(transferenceTransactionRepository.items[0]).toEqual(
        result.transferenceTransaction,
      );
      expect(
        transferenceTransactionRepository.items[0].recurrenceAmount,
      ).toEqual(recurrenceAmount);

      const originTransaction = transferenceTransactionRepository.items[0];

      for (
        let transactionIndex = 1;
        transactionIndex <= recurrenceLimit;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

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
    it("should be able to create a transference transaction without optional input fields", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
      });

      expect(isRight()).toBeTruthy();
    });

    it("should not be able to create a transference transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...transferenceTransaction.input,
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        originBankAccountId: undefined,
        // @ts-expect-error: field is required
        destinyBankAccountId: undefined,
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

    it("should not be able to create a transference transaction with invalid amount", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...transferenceTransaction.input,
        amount: -50,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a transference transaction with invalid description", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...transferenceTransaction.input,
        description: faker.string.alphanumeric({
          length: { min: 256, max: 300 },
        }),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create a transference transaction with invalid recurrence", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        ...transferenceTransaction.input,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
