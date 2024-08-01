import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryDebitExpenseTransactionRepository } from "test/repositories/in-memory-debit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";
import {
  UpdateDebitExpenseTransactionUseCase,
  UpdateDebitExpenseTransactionUseCaseInput,
} from "./update-debit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: UpdateDebitExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let transactionCategory: ReturnType<typeof makeTransactionCategory>;
let debitExpenseTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

describe("[Use Case] Update debit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    debitExpenseTransactionRepository =
      new InMemoryDebitExpenseTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        jobScheduling,
        transactionRecurrenceRepository: debitExpenseTransactionRepository,
        unitOfWork,
      },
    );

    sut = new UpdateDebitExpenseTransactionUseCase({
      bankAccountRepository,
      debitExpenseTransactionRepository,
      unitOfWork,
      transactionCategoryRepository,
      createTransactionRecurrenceUseCase,
    });

    const initialBalance = +faker.finance.amount({ dec: 0 });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId, balance: initialBalance });
    transactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });
    debitExpenseTransaction = makeDebitExpenseTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: transactionCategory.entity.id.value,
      amount: initialBalance,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await debitExpenseTransactionRepository.create(
      debitExpenseTransaction.entity,
    );
  });

  it("should be able to update a debit expense transaction", async () => {
    const newBankAccount = makeBankAccount({ userId });
    const newTransactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });

    await bankAccountRepository.create(newBankAccount.entity);
    await transactionCategoryRepository.create(newTransactionCategory.entity);

    const now = new Date();
    const updatedData = {
      amount: +faker.finance.amount({ dec: 0 }),
      description: faker.lorem.sentences().substring(1, 255).trim(),
      transactedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    } satisfies UpdateDebitExpenseTransactionUseCaseInput["data"];

    const { isRight, result } = await sut.execute<"success">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: {
        bankAccountId: newBankAccount.entity.id.value,
        categoryId: newTransactionCategory.entity.id.value,
        ...updatedData,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(result.debitExpenseTransaction).toMatchObject(updatedData);
    expect(debitExpenseTransactionRepository.items[0]).toMatchObject(
      updatedData,
    );
    expect(debitExpenseTransactionRepository.items[0].bankAccountId).toEqual(
      newBankAccount.entity.id,
    );
    expect(debitExpenseTransactionRepository.items[0].categoryId).toEqual(
      newTransactionCategory.entity.id,
    );
  });

  it("should be able to update bank account balance when the amount is updated and transaction already accomplished", async () => {
    await debitExpenseTransactionRepository.update(
      debitExpenseTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const oldBalance = bankAccountRepository.items[0].balance;
    const oldAmount = debitExpenseTransactionRepository.items[0].amount;
    const newAmount = +faker.finance.amount({ dec: 0 });

    const { isRight } = await sut.execute<"success">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: { amount: newAmount },
    });

    expect(isRight()).toBeTruthy();
    expect(debitExpenseTransactionRepository.items[0].amount).toEqual(
      newAmount,
    );
    expect(bankAccountRepository.items[0].balance).toEqual(
      oldBalance + oldAmount - newAmount,
    );
  });

  it("should be able to update bank account balance when the bank account is updated and transaction already accomplished", async () => {
    await debitExpenseTransactionRepository.update(
      debitExpenseTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const amount = debitExpenseTransactionRepository.items[0].amount;
    const newBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(newBankAccount.entity);

    const { isRight } = await sut.execute<"success">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: { bankAccountId: newBankAccount.entity.id.value },
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccount.input.balance + amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      newBankAccount.input.balance - amount,
    );
  });

  it("should not be able to update a non-existent debit expense transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      debitExpenseTransactionId: faker.string.uuid(),
      data: { amount: +faker.finance.amount({ dec: 0 }) },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a debit expense transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: { amount: +faker.finance.amount({ dec: 0 }) },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a debit expense transaction with non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: { bankAccountId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a debit expense transaction with non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
      data: { categoryId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    let originTransaction: ReturnType<typeof makeDebitExpenseTransaction>;
    let newTransactionCategory: ReturnType<typeof makeTransactionCategory>;

    beforeEach(async () => {
      originTransaction = makeDebitExpenseTransaction({
        bankAccountId: bankAccount.entity.id.value,
        categoryId: transactionCategory.entity.id.value,
        recurrencePeriod: "month",
      });
      newTransactionCategory = makeTransactionCategory({
        userId,
        isInExpense: false,
      });

      await debitExpenseTransactionRepository.create(originTransaction.entity);
      await transactionCategoryRepository.create(newTransactionCategory.entity);

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

    it("should be able to update the accomplished transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateDebitExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
        } else {
          expect(transaction.categoryId).toEqual(
            debitExpenseTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            debitExpenseTransaction.entity.description,
          );
        }
      }
    });

    it("should be able to update the pending transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
        amount: +faker.finance.amount({ dec: 0 }),
      } satisfies UpdateDebitExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (!transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
          expect(transaction.amount).toEqual(updatedData.amount);
        } else {
          expect(transaction.categoryId).toEqual(
            debitExpenseTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            debitExpenseTransaction.entity.description,
          );
          expect(transaction.amount).toEqual(
            debitExpenseTransaction.entity.amount,
          );
        }
      }
    });

    it("should be able to update the all transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateDebitExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        debitExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < debitExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          debitExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
        expect(transaction.description).toEqual(updatedData.description);
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a debit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        debitExpenseTransactionId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a debit expense transaction without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a debit expense transaction with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          recurrencePeriod: "day",
          recurrenceLimit: 5,
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of debit expense transaction with a new bank account", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "all",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of debit expense transaction with a new transacted at", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "all",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the accomplished recurrence of debit expense transaction with a new amount", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          amount: +faker.finance.amount({ dec: 0 }),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
        recurrence: "all",
        data: {
          amount: +faker.finance.amount({ dec: 0 }),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });
  });
});
