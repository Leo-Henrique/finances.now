import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryEarningTransactionRepository } from "test/repositories/in-memory-earning-transaction.repository";
import { InMemoryJobSchedulingService } from "test/services/in-memory-job-scheduling.service";
import { beforeEach, describe, expect, it } from "vitest";
import { DeleteEarningTransactionUseCase } from "./delete-earning-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobSchedulingService: InMemoryJobSchedulingService;

let sut: DeleteEarningTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let earningTransaction: ReturnType<typeof makeEarningTransaction>;

describe("[Use Case] Delete earning transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    earningTransactionRepository = new InMemoryEarningTransactionRepository({
      bankAccountRepository,
    });
    unitOfWork = new FakeUnitOfWork();
    jobSchedulingService = new InMemoryJobSchedulingService();

    sut = new DeleteEarningTransactionUseCase({
      earningTransactionRepository,
      unitOfWork,
      jobSchedulingService,
    });

    const initialBalance = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId, balance: initialBalance });
    earningTransaction = makeEarningTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: faker.string.uuid(),
      amount: initialBalance,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await earningTransactionRepository.create(earningTransaction.entity);
  });

  it("should be able to delete a earning transaction", async () => {
    const { isRight } = await sut.execute<"success">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(earningTransactionRepository.items[0]).toBeUndefined();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccount.input.balance - earningTransaction.entity.amount,
    );
  });

  it("should not be able to delete a non-existent earning transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      earningTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete a earning transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      earningTransactionId: earningTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    const ACCOMPLISHED_TRANSACTIONS_COUNT = 6;
    const PENDING_TRANSACTIONS_COUNT = 5;
    const TRANSACTIONS_COUNT =
      ACCOMPLISHED_TRANSACTIONS_COUNT + PENDING_TRANSACTIONS_COUNT + 1;

    let originTransaction: ReturnType<typeof makeEarningTransaction>;

    beforeEach(async () => {
      originTransaction = makeEarningTransaction({
        bankAccountId: bankAccount.entity.id.value,
        categoryId: faker.string.uuid(),
        recurrencePeriod: "month",
        isAccomplished: true,
      });

      await earningTransactionRepository.create(originTransaction.entity);

      for (let i = 1; i <= 5; i++) {
        const accomplishedTransaction = makeEarningTransaction({
          ...earningTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: true,
        });
        const pendingTransaction = makeEarningTransaction({
          ...earningTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: false,
        });

        await earningTransactionRepository.create(
          accomplishedTransaction.entity,
        );
        await earningTransactionRepository.create(pendingTransaction.entity);
      }
    });

    it("should be able to delete the accomplished transactions of the current recurrence", async () => {
      const totalAmount = earningTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
      });

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - ACCOMPLISHED_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        bankAccount.input.balance - totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeFalsy();
      }
    });

    it("should be able to delete the pending transactions of the current recurrence", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
      });

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - PENDING_TRANSACTIONS_COUNT,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeTruthy();
      }
    });

    it("should be able to delete the all transactions of the current recurrence", async () => {
      const totalAmount = earningTransactionRepository.items
        .filter(transaction => {
          const matchIds =
            transaction.id.value === originTransaction.entity.id.value ||
            transaction.originId?.value === originTransaction.entity.id.value;

          return matchIds && transaction.isAccomplished === true;
        })
        .reduce((total, { amount }) => total + amount, 0);

      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
      });

      expect(isRight()).toBeTruthy();
      expect(earningTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT -
          ACCOMPLISHED_TRANSACTIONS_COUNT -
          PENDING_TRANSACTIONS_COUNT,
      );
      expect(bankAccountRepository.items[0].balance).toEqual(
        bankAccount.input.balance - totalAmount,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        expect(transaction.originId).toBeNull();
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to delete a earning transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        earningTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
