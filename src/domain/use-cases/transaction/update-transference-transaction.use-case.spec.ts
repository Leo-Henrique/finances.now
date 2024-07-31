import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { InMemoryTransferenceTransactionRepository } from "test/repositories/in-memory-transference-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";
import {
  UpdateTransferenceTransactionUseCase,
  UpdateTransferenceTransactionUseCaseInput,
} from "./update-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let unitOfWork: FakeUnitOfWork;
let jobScheduling: InMemoryJobScheduling;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: UpdateTransferenceTransactionUseCase;

let userId: string;
let originBankAccount: ReturnType<typeof makeBankAccount>;
let destinyBankAccount: ReturnType<typeof makeBankAccount>;
let transferenceTransaction: ReturnType<typeof makeTransferenceTransaction>;

describe("[Use Case] Update transference transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    transferenceTransactionRepository =
      new InMemoryTransferenceTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();
    jobScheduling = new InMemoryJobScheduling();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        jobScheduling,
        transactionRecurrenceRepository: transferenceTransactionRepository,
        unitOfWork,
      },
    );

    sut = new UpdateTransferenceTransactionUseCase({
      bankAccountRepository,
      transferenceTransactionRepository,
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

  it("should be able to update a transference transaction", async () => {
    const newOriginBankAccount = makeBankAccount({ userId });
    const newDestinyBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(newOriginBankAccount.entity);
    await bankAccountRepository.create(newDestinyBankAccount.entity);

    const now = new Date();
    const updatedData = {
      amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      description: faker.lorem.sentences().substring(1, 255).trim(),
      transactedAt: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    } satisfies UpdateTransferenceTransactionUseCaseInput["data"];

    const { isRight, result } = await sut.execute<"success">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: {
        originBankAccountId: newOriginBankAccount.entity.id.value,
        destinyBankAccountId: newDestinyBankAccount.entity.id.value,
        ...updatedData,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(result.transferenceTransaction).toMatchObject(updatedData);
    expect(transferenceTransactionRepository.items[0]).toMatchObject(
      updatedData,
    );
    expect(
      transferenceTransactionRepository.items[0].originBankAccountId,
    ).toEqual(newOriginBankAccount.entity.id);
    expect(
      transferenceTransactionRepository.items[0].destinyBankAccountId,
    ).toEqual(newDestinyBankAccount.entity.id);
  });

  it("should be able to update origin bank account and destiny bank account balance when the amount is updated and transaction already accomplished", async () => {
    await transferenceTransactionRepository.update(
      transferenceTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const oldAmount = transferenceTransactionRepository.items[0].amount;
    const newAmount = faker.number.float({
      min: 1,
      max: 1000,
      fractionDigits: 2,
    });

    const { isRight } = await sut.execute<"success">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: { amount: newAmount },
    });

    expect(isRight()).toBeTruthy();
    expect(transferenceTransactionRepository.items[0].amount).toEqual(
      newAmount,
    );
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccount.input.balance + oldAmount - newAmount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccount.input.balance - oldAmount + newAmount,
    );
  });

  it("should be able to update origin bank account and destiny bank account balance when they are updated and transaction already accomplished", async () => {
    await transferenceTransactionRepository.update(
      transferenceTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const amount = transferenceTransactionRepository.items[0].amount;
    const newOriginBankAccount = makeBankAccount({ userId });
    const newDestinyBankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(newOriginBankAccount.entity);
    await bankAccountRepository.create(newDestinyBankAccount.entity);

    const { isRight } = await sut.execute<"success">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: {
        originBankAccountId: newOriginBankAccount.entity.id.value,
        destinyBankAccountId: newDestinyBankAccount.entity.id.value,
      },
    });

    expect(isRight()).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccount.input.balance + amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccount.input.balance - amount,
    );
    expect(bankAccountRepository.items[2].balance).toEqual(
      newOriginBankAccount.input.balance - amount,
    );
    expect(bankAccountRepository.items[3].balance).toEqual(
      newDestinyBankAccount.input.balance + amount,
    );
  });

  it("should not be able to update a non-existent transference transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      transferenceTransactionId: faker.string.uuid(),
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a transference transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: { amount: faker.number.float() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a transference transaction with non-existent origin bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: { originBankAccountId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to update a transference transaction with non-existent destiny bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      transferenceTransactionId: transferenceTransaction.entity.id.value,
      data: { destinyBankAccountId: faker.string.uuid() },
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] recurring transaction", () => {
    let originTransaction: ReturnType<typeof makeTransferenceTransaction>;

    beforeEach(async () => {
      originTransaction = makeTransferenceTransaction({
        originBankAccountId: originBankAccount.entity.id.value,
        destinyBankAccountId: destinyBankAccount.entity.id.value,
        recurrencePeriod: "month",
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

    it("should be able to update the accomplished transactions of the current recurrence", async () => {
      const updatedData = {
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateTransferenceTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "accomplished",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (transaction.isAccomplished) {
          expect(transaction.description).toEqual(updatedData.description);
        } else {
          expect(transaction.description).toEqual(
            transferenceTransaction.entity.description,
          );
        }
      }
    });

    it("should be able to update the pending transactions of the current recurrence", async () => {
      const updatedData = {
        description: faker.lorem.sentences().substring(1, 255).trim(),
        amount: faker.number.float({ min: 1, max: 1000, fractionDigits: 2 }),
      } satisfies UpdateTransferenceTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "pending",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        if (!transaction.isAccomplished) {
          expect(transaction.description).toEqual(updatedData.description);
          expect(transaction.amount).toEqual(updatedData.amount);
        } else {
          expect(transaction.description).toEqual(
            transferenceTransaction.entity.description,
          );
          expect(transaction.amount).toEqual(
            transferenceTransaction.entity.amount,
          );
        }
      }
    });

    it("should be able to update the all transactions of the current recurrence", async () => {
      const updatedData = {
        description: faker.lorem.sentences().substring(1, 255).trim(),
      } satisfies UpdateTransferenceTransactionUseCaseInput["data"];

      const { isRight } = await sut.execute<"success">({
        userId,
        transferenceTransactionId: originTransaction.entity.id.value,
        recurrence: "all",
        data: updatedData,
      });

      expect(isRight()).toBeTruthy();

      for (
        let transactionIndex = 0;
        transactionIndex < transferenceTransactionRepository.items.length;
        transactionIndex++
      ) {
        const transaction =
          transferenceTransactionRepository.items[transactionIndex];

        if (!transaction.recurrencePeriod || !transaction.originId) continue;

        expect(transaction.description).toEqual(updatedData.description);
      }
    });
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a transference transaction without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        transferenceTransactionId: undefined,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a transference transaction without any fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        data: {},
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update a transference transaction with not allowed fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        data: {
          // @ts-expect-error: fields is not allowed
          recurrencePeriod: "day",
          recurrenceLimit: 5,
        },
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of transference transaction with a new origin bank account", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          originBankAccountId: faker.string.uuid(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          originBankAccountId: faker.string.uuid(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "all",
        data: {
          originBankAccountId: faker.string.uuid(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of transference transaction with a new destiny bank account", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          destinyBankAccountId: faker.string.uuid(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          destinyBankAccountId: faker.string.uuid(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "all",
        data: {
          destinyBankAccountId: faker.string.uuid(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the recurrence of transference transaction with a new transacted at", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const pendingUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "pending",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(pendingUpdateResult.isLeft()).toBeTruthy();
      expect(pendingUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "all",
        data: {
          transactedAt: faker.date.recent(),
        },
      });

      expect(allUpdateResult.isLeft()).toBeTruthy();
      expect(allUpdateResult.reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to update the accomplished recurrence of transference transaction with a new amount", async () => {
      const accomplishUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
        recurrence: "accomplished",
        data: {
          amount: faker.number.float(),
        },
      });

      expect(accomplishUpdateResult.isLeft()).toBeTruthy();
      expect(accomplishUpdateResult.reason).toBeInstanceOf(ValidationError);

      const allUpdateResult = await sut.execute<"error">({
        userId,
        transferenceTransactionId: transferenceTransaction.entity.id.value,
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
