import { ValidationError } from "@/core/errors/errors";
import { ForbiddenActionError, ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeCreditCard } from "test/factories/make-credit-card";
import { makeCreditExpenseTransaction } from "test/factories/make-credit-expense-transaction";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { InMemoryCreditExpenseTransactionRepository } from "test/repositories/in-memory-credit-expense-transaction.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";
import {
  UpdateCreditExpenseTransactionUseCase,
  UpdateCreditExpenseTransactionUseCaseInput,
} from "./update-credit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let creditCardRepository: InMemoryCreditCardRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let creditExpenseTransactionRepository: InMemoryCreditExpenseTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: UpdateCreditExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let creditCard: ReturnType<typeof makeCreditCard>;
let transactionCategory: ReturnType<typeof makeTransactionCategory>;
let creditExpenseTransaction: ReturnType<typeof makeCreditExpenseTransaction>;

describe("[Use Case] Update credit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    creditCardRepository = new InMemoryCreditCardRepository({
      bankAccountRepository,
    });
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    creditExpenseTransactionRepository =
      new InMemoryCreditExpenseTransactionRepository({ creditCardRepository });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        jobScheduling,
        transactionRecurrenceRepository: creditExpenseTransactionRepository,
        unitOfWork,
      },
    );

    sut = new UpdateCreditExpenseTransactionUseCase({
      creditCardRepository,
      creditExpenseTransactionRepository,
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
    creditCard = makeCreditCard({ bankAccountId: bankAccount.entity.id.value });
    transactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });
    creditExpenseTransaction = makeCreditExpenseTransaction({
      creditCardId: creditCard.entity.id.value,
      categoryId: transactionCategory.entity.id.value,
      amount: initialBalance,
    });

    await bankAccountRepository.create(bankAccount.entity);
    await creditCardRepository.create(creditCard.entity);
    await creditExpenseTransactionRepository.create(
      creditExpenseTransaction.entity,
    );
  });

  it("should be able to update a credit expense transaction", async () => {
    const newCreditCard = makeCreditCard({
      bankAccountId: bankAccount.entity.id.value,
    });
    const newTransactionCategory = makeTransactionCategory({
      userId,
      isInExpense: false,
    });

    await creditCardRepository.create(newCreditCard.entity);
    await transactionCategoryRepository.create(newTransactionCategory.entity);

    const now = new Date();
    const updatedData = {
      amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      description: faker.lorem.sentences().substring(1, 255).trim(),
      transactedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    } satisfies UpdateCreditExpenseTransactionUseCaseInput["data"];

    const { isRight, result } = await sut.execute<"success">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: {
        creditCardId: newCreditCard.entity.id.value,
        categoryId: newTransactionCategory.entity.id.value,
        ...updatedData,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(result.creditExpenseTransaction).toMatchObject(updatedData);
    expect(creditExpenseTransactionRepository.items[0]).toMatchObject(
      updatedData,
    );
    expect(creditExpenseTransactionRepository.items[0].creditCardId).toEqual(
      newCreditCard.entity.id,
    );
    expect(creditExpenseTransactionRepository.items[0].categoryId).toEqual(
      newTransactionCategory.entity.id,
    );
  });

  it("should not be able to update sensitive information if the transaction has already accomplished", async () => {
    await creditExpenseTransactionRepository.update(
      creditExpenseTransaction.entity,
      { isAccomplished: true },
    );

    const creditCardUpdateResult = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: {
        creditCardId: faker.string.uuid(),
      },
    });

    expect(creditCardUpdateResult.isLeft()).toBeTruthy();
    expect(creditCardUpdateResult.reason).toBeInstanceOf(ForbiddenActionError);

    const transactedDateUpdateResult = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: {
        transactedAt: faker.date.recent(),
      },
    });

    expect(transactedDateUpdateResult.isLeft()).toBeTruthy();
    expect(transactedDateUpdateResult.reason).toBeInstanceOf(
      ForbiddenActionError,
    );

    const amountUpdateResult = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: {
        amount: faker.number.float({ min: 1, fractionDigits: 2 }),
      },
    });

    expect(amountUpdateResult.isLeft()).toBeTruthy();
    expect(amountUpdateResult.reason).toBeInstanceOf(ForbiddenActionError);
  });

  it("should not be able to update a non-existent credit expense transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditExpenseTransactionId: faker.string.uuid(),
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit expense transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit expense transaction with non-existent credit card", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: { creditCardId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a credit expense transaction with non-existent transaction category", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
      data: { categoryId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    let originTransaction: ReturnType<typeof makeCreditExpenseTransaction>;
    let newTransactionCategory: ReturnType<typeof makeTransactionCategory>;

    beforeEach(async () => {
      originTransaction = makeCreditExpenseTransaction({
        creditCardId: creditCard.entity.id.value,
        categoryId: transactionCategory.entity.id.value,
        recurrencePeriod: "month",
      });
      newTransactionCategory = makeTransactionCategory({
        userId,
        isInExpense: false,
      });

      await creditExpenseTransactionRepository.create(originTransaction.entity);
      await transactionCategoryRepository.create(newTransactionCategory.entity);

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

    it("should be able to update the accomplished transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateCreditExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        creditExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < creditExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
        } else {
          expect(transaction.categoryId).toEqual(
            creditExpenseTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            creditExpenseTransaction.entity.description,
          );
        }
      }
    });

    it("should be able to update the pending transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
        amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      } satisfies UpdateCreditExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        creditExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < creditExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (!transaction.isAccomplished) {
          expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
          expect(transaction.description).toEqual(updatedData.description);
          expect(transaction.amount).toEqual(updatedData.amount);
        } else {
          expect(transaction.categoryId).toEqual(
            creditExpenseTransaction.entity.categoryId,
          );
          expect(transaction.description).toEqual(
            creditExpenseTransaction.entity.description,
          );
          expect(transaction.amount).toEqual(
            creditExpenseTransaction.entity.amount,
          );
        }
      }
    });

    it("should be able to update the all transactions of the current recurrence", async () => {
      const updatedData = {
        categoryId: newTransactionCategory.entity.id.value,
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateCreditExpenseTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        creditExpenseTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < creditExpenseTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          creditExpenseTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.categoryId.value).toEqual(updatedData.categoryId);
        expect(transaction.description).toEqual(updatedData.description);
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a credit expense transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        creditExpenseTransactionId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a credit expense transaction without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a credit expense transaction with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          recurrencePeriod: "day",
          recurrenceLimit: 5,
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of credit expense transaction with a new bank account", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          creditCardId: faker.string.uuid(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          creditCardId: faker.string.uuid(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "all",
        data: {
          creditCardId: faker.string.uuid(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of credit expense transaction with a new transacted at", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "all",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the accomplished recurrence of credit expense transaction with a new amount", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          amount: faker.number.float(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        creditExpenseTransactionId: creditExpenseTransaction.entity.id.value,
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
