import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryEarningTransactionRepository } from "test/repositories/in-memory-earning-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";
import {
  UpdateEarningTransactionUseCase,
  UpdateEarningTransactionUseCaseInput,
} from "./update-earning-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: UpdateEarningTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let transactionCategory: ReturnType<typeof makeTransactionCategory>;
let earningTransaction: ReturnType<typeof makeEarningTransaction>;

describe("[Use Case] Update earning transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    earningTransactionRepository = new InMemoryEarningTransactionRepository({
      bankAccountRepository,
    });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        jobScheduling,
        transactionRecurrenceRepository: earningTransactionRepository,
        unitOfWork,
      },
    );

    sut = new UpdateEarningTransactionUseCase({
      bankAccountRepository,
      earningTransactionRepository,
      unitOfWork,
      transactionCategoryRepository,
      createTransactionRecurrenceUseCase,
    });

    const initialBalance = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId, balance: initialBalance });
    transactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });
    earningTransaction = makeEarningTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: transactionCategory.entity.id.value,
      amount: initialBalance,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await earningTransactionRepository.create(earningTransaction.entity);
  });

  it("should be able to update a earning transaction", async () => {
    const newBankAccount = makeBankAccount({ userId });
    const newTransactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });

    await bankAccountRepository.create(newBankAccount.entity);
    await transactionCategoryRepository.create(newTransactionCategory.entity);

    const now = new Date();
    const updatedData = {
      amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      description: faker.lorem.sentences().substring(1, 255).trim(),
      transactedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    } satisfies UpdateEarningTransactionUseCaseInput["data"];

    const { isRight, result } = await sut.execute<"success">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
      data: {
        bankAccountId: newBankAccount.entity.id.value,
        categoryId: newTransactionCategory.entity.id.value,
        ...updatedData,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(result.earningTransaction).toMatchObject(updatedData);
    expect(earningTransactionRepository.items[0]).toMatchObject(updatedData);
    expect(earningTransactionRepository.items[0].bankAccountId).toEqual(
      newBankAccount.entity.id,
    );
    expect(earningTransactionRepository.items[0].categoryId).toEqual(
      newTransactionCategory.entity.id,
    );
  });

  it("should be able to update bank account balance when the amount is updated and transaction already accomplished", async () => {
    await earningTransactionRepository.update(earningTransaction.entity, {
      isAccomplished: true,
    });

    const oldBalance = bankAccountRepository.items[0].balance;
    const oldAmount = earningTransactionRepository.items[0].amount;
    const newAmount = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    const { isRight } = await sut.execute<"success">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
      data: { amount: newAmount },
    });

    expect(isRight()).toBeTruthy();
    expect(earningTransactionRepository.items[0].amount).toEqual(newAmount);
    expect(bankAccountRepository.items[0].balance).toEqual(
      oldBalance - oldAmount + newAmount,
    );
  });

  it("should be able to update bank account balance when the bank account is updated and transaction already accomplished", async () => {
    await earningTransactionRepository.update(earningTransaction.entity, {
      isAccomplished: true,
    });

    const amount = earningTransactionRepository.items[0].amount;
    const newBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(newBankAccount.entity);

    const { isRight } = await sut.execute<"success">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
      data: { bankAccountId: newBankAccount.entity.id.value },
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccount.input.balance - amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      newBankAccount.input.balance + amount,
    );
  });

  it("should not be able to update a non-existent earning transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      earningTransactionId: faker.string.uuid(),
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a earning transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      earningTransactionId: earningTransaction.entity.id.value,
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a earning transaction with non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      earningTransactionId: earningTransaction.entity.id.value,
      data: { bankAccountId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a earning transaction with non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      earningTransactionId: earningTransaction.entity.id.value,
      data: { categoryId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    let originTransaction: ReturnType<typeof makeEarningTransaction>;
    let newTransactionCategory: ReturnType<typeof makeTransactionCategory>;

    beforeEach(async () => {
      originTransaction = makeEarningTransaction({
        bankAccountId: bankAccount.entity.id.value,
        categoryId: transactionCategory.entity.id.value,
        recurrencePeriod: "month",
      });
      newTransactionCategory = makeTransactionCategory({
        userId,
        isInExpense: false,
      });

      await earningTransactionRepository.create(originTransaction.entity);
      await transactionCategoryRepository.create(newTransactionCategory.entity);

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

    it("should be able to update the accomplished transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateEarningTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
        } else {
          expect(transaction.categoryId).toEqual(
            earningTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            earningTransaction.entity.description,
          );
        }
      }
    });

    it("should be able to update the pending transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
        amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      } satisfies UpdateEarningTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (!transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
          expect(transaction.amount).toEqual(updatedData.amount);
        } else {
          expect(transaction.categoryId).toEqual(
            earningTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            earningTransaction.entity.description,
          );
          expect(transaction.amount).toEqual(earningTransaction.entity.amount);
        }
      }
    });

    it("should be able to update the all transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateEarningTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        earningTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < earningTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          earningTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
        expect(transaction.description).toEqual(updatedData.description);
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a earning transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        earningTransactionId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a earning transaction without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a earning transaction with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          recurrencePeriod: "day",
          recurrenceLimit: 5,
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of earning transaction with a new bank account", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "all",
        data: {
          bankAccountId: faker.string.uuid(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of earning transaction with a new transacted at", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "all",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the accomplished recurrence of earning transaction with a new amount", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          amount: faker.number.float(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        earningTransactionId: earningTransaction.entity.id.value,
        recurrence: "all",
        data: {
          amount: faker.number.float(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });
  });
});
