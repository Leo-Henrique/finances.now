import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryDebitExpenseTransactionRepository } from "test/repositories/in-memory-debit-expense-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { DeleteDebitExpenseTransactionUseCase } from "./delete-debit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;

let sut: DeleteDebitExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let debitExpenseTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

describe("[Use Case] Delete debit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    debitExpenseTransactionRepository =
      new InMemoryDebitExpenseTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();

    sut = new DeleteDebitExpenseTransactionUseCase({
      debitExpenseTransactionRepository,
      unitOfWork,
      jobScheduling,
    });

    const initialBalance = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId, balance: initialBalance });
    debitExpenseTransaction = makeDebitExpenseTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: faker.string.uuid(),
      amount: initialBalance,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await debitExpenseTransactionRepository.create(
      debitExpenseTransaction.entity,
    );
  });

  it("should be able to delete a debit expense transaction", async () => {
    const { isRight } = await sut.execute<"success">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(debitExpenseTransactionRepository.items[0]).toBeUndefined();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccount.input.balance + debitExpenseTransaction.entity.amount,
    );
  });

  it("should not be able to delete a non-existent debit expense transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      debitExpenseTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete a debit expense transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    const ACCOMPLISHED_TRANSACTIONS_COUNT = 6;
    const PENDING_TRANSACTIONS_COUNT = 5;
    const TRANSACTIONS_COUNT =
      ACCOMPLISHED_TRANSACTIONS_COUNT + PENDING_TRANSACTIONS_COUNT + 1;

    let originTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

    beforeEach(async () => {
      originTransaction = makeDebitExpenseTransaction({
        bankAccountId: bankAccount.entity.id.value,
        categoryId: faker.string.uuid(),
        recurrencePeriod: "month",
        isAccomplished: true,
      });

      await debitExpenseTransactionRepository.create(originTransaction.entity);

      for (let i = 1; i <= 5; i++) {
        const accomplishedTransaction = makeDebitExpenseTransaction({
          ...debitExpenseTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: true,
        });
        const pendingTransaction = makeDebitExpenseTransaction({
          ...debitExpenseTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: false,
        });

        await debitExpenseTransactionRepository.create(
          accomplishedTransaction.entity,
        );
        await debitExpenseTransactionRepository.create(
          pendingTransaction.entity,
        );
      }
    });

    it("should be able to delete the accomplished transactions of the current recurrence", async () => {
      const totalAmount = debitExpenseTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
      });

      expect(isRight()).toBeTruthy();
      expect(debitExpenseTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - ACCOMPLISHED_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        bankAccount.input.balance + totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeFalsy();
      }
    });

    it("should be able to delete the pending transactions of the current recurrence", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
      });

      expect(isRight()).toBeTruthy();
      expect(debitExpenseTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - PENDING_TRANSACTIONS_COUNT,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeTruthy();
      }
    });

    it("should be able to delete the all transactions of the current recurrence", async () => {
      const totalAmount = debitExpenseTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
      });

      expect(isRight()).toBeTruthy();
      expect(debitExpenseTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT -
          ACCOMPLISHED_TRANSACTIONS_COUNT -
          PENDING_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        bankAccount.input.balance + totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        expect(transaction.originId).toBeNull();
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to delete a debit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        debitExpenseTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
