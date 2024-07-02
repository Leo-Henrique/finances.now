import { InferResultOfEither } from "@/core/either";
import { ValidationError } from "@/core/errors/errors";
import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryDebitExpenseTransactionRepository } from "test/repositories/in-memory-debit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDateByPeriod } from "test/utils/milliseconds-remaining-for-date-by-period";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreateDebitExpenseTransactionUseCase,
  CreateDebitExpenseTransactionUseCaseOutput,
} from "./create-debit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let taskSchedulingService: InMemoryJobSchedulingService;
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
    taskSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateDebitExpenseTransactionUseCase({
      bankAccountRepository,
      transactionCategoryRepository,
      debitExpenseTransactionRepository,
      taskSchedulingService,
      unitOfWork,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    const [transactionCategory] =
      await transactionCategoryRepository.findManyFromUserOfEarning(userId);

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

  it("should be able to subtract bank account balance with amount transaction", async () => {
    const userBalance = bankAccountRepository.items[0].balance;
    const amount = 50;
    const { isRight } = await sut.execute<"success">({
      userId,
      ...debitExpenseTransaction.input,
      amount,
      transactedAt: faker.date.recent(),
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      userBalance - amount,
    );
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

  describe("[Business Roles] transaction scheduling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date());
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should be able update bank account balance at the start of the day of the transaction date", async () => {
      const daysToFirstTransactionOccur = 2;
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        transactedAt: new Date(
          new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
        ),
      });

      expect(isRight()).toBeTruthy();
      expect(bankAccountRepository.items[0].balance).toEqual(oldBalance);

      vi.advanceTimersByTime(
        millisecondsRemainingForDateByPeriod(
          daysToFirstTransactionOccur,
          "day",
        ),
      );
      await new Promise(process.nextTick);

      expect(bankAccountRepository.items[0].balance).toEqual(
        oldBalance - amount,
      );
    });

    it("should be able to repeat update of bank account balance daily", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
      });

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= 6;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(millisecondsRemainingForDateByPeriod(1, "day"));
        await new Promise(process.nextTick);

        expect(bankAccountRepository.items[0].balance).toEqual(
          oldBalance - amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance weekly", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "week",
      });

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= 6;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(millisecondsRemainingForDateByPeriod(7, "day"));
        await new Promise(process.nextTick);

        expect(bankAccountRepository.items[0].balance).toEqual(
          oldBalance - amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance monthly", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "month",
      }); 

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= 6;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(
          millisecondsRemainingForDateByPeriod(1, "month"),
        );
        await new Promise(process.nextTick);

        expect(bankAccountRepository.items[0].balance).toEqual(
          oldBalance - amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance annually", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "year",
      });

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= 6;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(millisecondsRemainingForDateByPeriod(1, "year"));
        await new Promise(process.nextTick);

        expect(bankAccountRepository.items[0].balance).toEqual(
          oldBalance - amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance with a limit", async () => {
      const recurrenceLimit = 4;
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "month",
        recurrenceLimit,
      });

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= recurrenceLimit + 10;
        currentTransaction++
      ) {
        const lastTransaction = recurrenceLimit + 2;

        vi.advanceTimersByTime(
          millisecondsRemainingForDateByPeriod(1, "month"),
        );
        await new Promise(process.nextTick);

        if (currentTransaction < lastTransaction) {
          expect(bankAccountRepository.items[0].balance).toEqual(
            oldBalance - amount * currentTransaction,
          );
        } else {
          expect(bankAccountRepository.items[0].balance).toEqual(
            oldBalance - amount * lastTransaction,
          );
        }
      }
    });

    it("should be able to repeat update of bank account balance in a personalized way with a period", async () => {
      const amount = 50;
      const oldBalance = bankAccountRepository.items[0].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...debitExpenseTransaction.input,
        amount,
        recurrencePeriod: "day",
        recurrenceAmount: 3,
      });

      expect(isRight()).toBeTruthy();

      for (
        let currentTransaction = 2;
        currentTransaction <= 6;
        currentTransaction++
      ) {
        vi.advanceTimersByTime(millisecondsRemainingForDateByPeriod(3, "day"));
        await new Promise(process.nextTick);

        expect(bankAccountRepository.items[0].balance).toEqual(
          oldBalance - amount * currentTransaction,
        );
      }
    });

    it("should not be able to schedule bank account balance update when database transaction error occurs", async () => {
      type Result = InferResultOfEither<
        CreateDebitExpenseTransactionUseCaseOutput,
        "error"
      >;

      const { isLeft, reason } = (await sut["handle"]({
        userId,
        ...debitExpenseTransaction.input,
        transactedAt: new Date(new Date().getTime() + dayInMilliseconds(1)),
        amount: 50,
        // @ts-expect-error: unexpected field value
        recurrencePeriod: faker.lorem.words(1),
      })) as Result;

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(FailedToCreateTransactionError);
      expect(taskSchedulingService.items).toHaveLength(0);
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
          length: { min: 255, max: 300 },
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
