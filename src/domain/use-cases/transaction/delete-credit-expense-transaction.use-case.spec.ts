import { ValidationError } from "@/core/errors/errors";
import { ForbiddenActionError, ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeCreditCard } from "test/factories/make-credit-card";
import { makeCreditExpenseTransaction } from "test/factories/make-credit-expense-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { InMemoryCreditExpenseTransactionRepository } from "test/repositories/in-memory-credit-expense-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { DeleteCreditExpenseTransactionUseCase } from "./delete-credit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let creditCardRepository: InMemoryCreditCardRepository;
let creditExpenseTransactionRepository: InMemoryCreditExpenseTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;

let sut: DeleteCreditExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let creditCard: ReturnType<typeof makeCreditCard>;
let creditExpenseTransaction: ReturnType<typeof makeCreditExpenseTransaction>;

describe("[Use Case] Delete credit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    creditCardRepository = new InMemoryCreditCardRepository({
      bankAccountRepository,
    });
    creditExpenseTransactionRepository =
      new InMemoryCreditExpenseTransactionRepository({
        creditCardRepository,
      });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();

    sut = new DeleteCreditExpenseTransactionUseCase({
      creditExpenseTransactionRepository,
      unitOfWork,
      jobScheduling,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });
    creditCard = makeCreditCard({
      bankAccountId: bankAccount.entity.id.value,
    });
    creditExpenseTransaction = makeCreditExpenseTransaction({
      creditCardId: creditCard.entity.id.value,
      categoryId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccount.entity);
    await creditCardRepository.create(creditCard.entity);
    await creditExpenseTransactionRepository.create(
      creditExpenseTransaction.entity,
    );
  });

  it("should be able to delete a credit expense transaction", async () => {
    const { isRight } = await sut.execute<"success">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(creditExpenseTransactionRepository.items[0]).toBeUndefined();
  });

  it("should not be able to delete a credit expense transaction has already accomplished", async () => {
    await creditExpenseTransactionRepository.update(
      creditExpenseTransaction.entity,
      { isAccomplished: true },
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ForbiddenActionError);
  });

  it("should not be able to delete a non-existent credit expense transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to delete a credit expense transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    const ACCOMPLISHED_TRANSACTIONS_COUNT = 6;
    const PENDING_TRANSACTIONS_COUNT = 5;
    const TRANSACTIONS_COUNT =
      ACCOMPLISHED_TRANSACTIONS_COUNT + PENDING_TRANSACTIONS_COUNT + 1;

    let originTransaction: ReturnType<typeof makeCreditExpenseTransaction>;

    beforeEach(async () => {
      originTransaction = makeCreditExpenseTransaction({
        creditCardId: creditCard.entity.id.value,
        categoryId: faker.string.uuid(),
        recurrencePeriod: "month",
        isAccomplished: true,
      });

      await creditExpenseTransactionRepository.create(originTransaction.entity);

      for (let i = 1; i <= 5; i++) {
        const accomplishedTransaction = makeCreditExpenseTransaction({
          ...creditExpenseTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: true,
        });
        const pendingTransaction = makeCreditExpenseTransaction({
          ...creditExpenseTransaction.input,
          originId: originTransaction.entity.id,
          isAccomplished: false,
        });

        await creditExpenseTransactionRepository.create(
          accomplishedTransaction.entity,
        );
        await creditExpenseTransactionRepository.create(
          pendingTransaction.entity,
        );
      }
    });

    it("should be able to delete the pending transactions of the current recurrence", async () => {
      const { isRight } = await sut.execute<"success">({
        userId,
        creditExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
      });

      expect(isRight()).toBeTruthy();
      expect(creditExpenseTransactionRepository.items).toHaveLength(
        TRANSACTIONS_COUNT - PENDING_TRANSACTIONS_COUNT,
      );

      for (
        let transactionIndex = 0;
        transactionIndex < creditExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.isAccomplished).toBeTruthy();
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to delete a credit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        creditExpenseTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
