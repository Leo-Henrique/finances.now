import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryTransferenceTransactionRepository } from "test/repositories/in-memory-transference-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { DeleteTransferenceTransactionUseCase } from "./delete-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;

let sut: DeleteTransferenceTransactionUseCase;

let userId: string;
let originBankAccount: ReturnType<typeof makeBankAccount>;
let destinyBankAccount: ReturnType<typeof makeBankAccount>;
let transferenceTransaction: ReturnType<typeof makeTransferenceTransaction>;

describe("[Use Case] Delete transference transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transferenceTransactionRepository =
      new InMemoryTransferenceTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();

    sut = new DeleteTransferenceTransactionUseCase({
      transferenceTransactionRepository,
      unitOfWork,
      jobScheduling,
    });

    const initialBalance = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    userId = faker.string.uuid();
    originBankAccount = makeBankAccount({ userId, balance: initialBalance });
    destinyBankAccount = makeBankAccount({ userId, balance: initialBalance });
    transferenceTransaction = makeTransferenceTransaction({
      originBankAccountId: originBankAccount.entity.id.value,
      destinyBankAccountId: destinyBankAccount.entity.id.value,
      amount: initialBalance,
    });

    await bankAccountRepository.create(originBankAccount.entity);
    await bankAccountRepository.create(destinyBankAccount.entity);
    await transferenceTransactionRepository.create(
      transferenceTransaction.entity,
    );
  });

  it("should be able to delete a transference transaction", async () => {
    const { isRight } = await sut.execute<"success">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(transferenceTransactionRepository.items[0]).toBeUndefined();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccount.input.balance + transferenceTransaction.entity.amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccount.input.balance - transferenceTransaction.entity.amount,
    );
  });

  it("should not be able to delete a non-existent transference transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      transferenceTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete a transference transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      transferenceTransactionId: transferenceTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    const ACCOMPLISHED_TRANSACTIONS_COUNT = 6;
    const PENDING_TRANSACTIONS_COUNT = 5;
    const TRANSACTIONS_COUNT =
      ACCOMPLISHED_TRANSACTIONS_COUNT + PENDING_TRANSACTIONS_COUNT + 1;

    let originTransaction: ReturnType<typeof makeTransferenceTransaction>;

    beforeEach(async () => {
      originTransaction = makeTransferenceTransaction({
        originBankAccountId: originBankAccount.entity.id.value,
        destinyBankAccountId: destinyBankAccount.entity.id.value,
        recurrencePeriod: "month",
        isAccomplished: true,
      });

      await transferenceTransactionRepository.create(originTransaction.entity);

      for (let i = 1; i <= 5; i++) {
        const accomplishedTransaction = makeTransferenceTransaction({
          ...transferenceTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: true,
        });
        const pendingTransaction = makeTransferenceTransaction({
          ...transferenceTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: false,
        });

        await transferenceTransactionRepository.create(
          accomplishedTransaction.entity,
        );
        await transferenceTransactionRepository.create(
          pendingTransaction.entity,
        );
      }
    });

    it("should be able to delete the accomplished transactions of the current recurrence", async () => {
      const totalAmount = transferenceTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
      });

      expect(isRight()).toBeTruthy();
      expect(transferenceTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - ACCOMPLISHED_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        originBankAccount.input.balance + totalAmount,
      );
      expect(bankAccountRepository.items[1].balance).toEqual(
        destinyBankAccount.input.balance - totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeFalsy();
      }
    });

    it("should be able to delete the pending transactions of the current recurrence", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
      });

      expect(isRight()).toBeTruthy();
      expect(transferenceTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - PENDING_TRANSACTIONS_COUNT,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeTruthy();
      }
    });

    it("should be able to delete the all transactions of the current recurrence", async () => {
      const totalAmount = transferenceTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
      });

      expect(isRight()).toBeTruthy();
      expect(transferenceTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT -
          ACCOMPLISHED_TRANSACTIONS_COUNT -
          PENDING_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        originBankAccount.input.balance + totalAmount,
      );
      expect(bankAccountRepository.items[1].balance).toEqual(
        destinyBankAccount.input.balance - totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        expect(transaction.originId).toBeNull();
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to delete a transference transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        transferenceTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
