import { InferResultOfEither } from "@/core/either";
import { ValidationError } from "@/core/errors/errors";
import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryTransferenceTransactionRepository } from "test/repositories/in-memory-transference-transaction.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { millisecondsRemainingForDateByPeriod } from "test/utils/milliseconds-remaining-for-date-by-period";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CreateTransferenceTransactionUseCase,
  CreateTransferenceTransactionUseCaseOutput,
} from "./create-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let taskSchedulingService: InMemoryJobSchedulingService;
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
      new InMemoryTransferenceTransactionRepository();
    taskSchedulingService = new InMemoryJobSchedulingService();
    unitOfWork = new FakeUnitOfWork();

    sut = new CreateTransferenceTransactionUseCase({
      bankAccountRepository,
      transferenceTransactionRepository,
      taskSchedulingService,
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

  it("should be able to subtract origin bank account balance with amount transaction", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;

    const amount = 50;
    const { isRight } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      amount,
      transactedAt: faker.date.recent(),
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance - amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance + amount,
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
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      originBankAccountId: bankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a destiny bank account that does not belong to the user", async () => {
    const bankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      destinyBankAccountId: bankAccountFromAnotherUser.entity.id.value,
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
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
        amount,
        transactedAt: new Date(
          new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
        ),
      });

      expect(isRight()).toBeTruthy();
      expect(bankAccountRepository.items[0].balance).toEqual(
        originBankAccountOldBalance,
      );
      expect(bankAccountRepository.items[1].balance).toEqual(
        destinyBankAccountOldBalance,
      );

      vi.advanceTimersByTime(
        millisecondsRemainingForDateByPeriod(
          daysToFirstTransactionOccur,
          "day",
        ),
      );
      await new Promise(process.nextTick);

      expect(bankAccountRepository.items[0].balance).toEqual(
        originBankAccountOldBalance - amount,
      );
      expect(bankAccountRepository.items[1].balance).toEqual(
        destinyBankAccountOldBalance + amount,
      );
    });

    it("should be able to repeat update of bank account balance daily", async () => {
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
          originBankAccountOldBalance - amount * currentTransaction,
        );
        expect(bankAccountRepository.items[1].balance).toEqual(
          destinyBankAccountOldBalance + amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance weekly", async () => {
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
          originBankAccountOldBalance - amount * currentTransaction,
        );
        expect(bankAccountRepository.items[1].balance).toEqual(
          destinyBankAccountOldBalance + amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance monthly", async () => {
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
          originBankAccountOldBalance - amount * currentTransaction,
        );
        expect(bankAccountRepository.items[1].balance).toEqual(
          destinyBankAccountOldBalance + amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance annually", async () => {
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
          originBankAccountOldBalance - amount * currentTransaction,
        );
        expect(bankAccountRepository.items[1].balance).toEqual(
          destinyBankAccountOldBalance + amount * currentTransaction,
        );
      }
    });

    it("should be able to repeat update of bank account balance with a limit", async () => {
      const recurrenceLimit = 4;
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
            originBankAccountOldBalance - amount * currentTransaction,
          );
          expect(bankAccountRepository.items[1].balance).toEqual(
            destinyBankAccountOldBalance + amount * currentTransaction,
          );
        } else {
          expect(bankAccountRepository.items[0].balance).toEqual(
            originBankAccountOldBalance - amount * lastTransaction,
          );
          expect(bankAccountRepository.items[1].balance).toEqual(
            destinyBankAccountOldBalance + amount * lastTransaction,
          );
        }
      }
    });

    it("should be able to repeat update of bank account balance in a personalized way with a period", async () => {
      const amount = 50;
      const originBankAccountOldBalance =
        bankAccountRepository.items[0].balance;
      const destinyBankAccountOldBalance =
        bankAccountRepository.items[1].balance;

      const { isRight } = await sut.execute<"success">({
        userId,
        ...transferenceTransaction.input,
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
          originBankAccountOldBalance - amount * currentTransaction,
        );
        expect(bankAccountRepository.items[1].balance).toEqual(
          destinyBankAccountOldBalance + amount * currentTransaction,
        );
      }
    });

    it("should not be able to schedule bank account balance update when database transaction error occurs", async () => {
      type Result = InferResultOfEither<
        CreateTransferenceTransactionUseCaseOutput,
        "error"
      >;

      const { isLeft, reason } = (await sut["handle"]({
        userId,
        ...transferenceTransaction.input,
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
          length: { min: 255, max: 300 },
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
