import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";

import { InMemoryJobScheduling } from "test/gateways/in-memory-job-scheduling";
import { InMemoryTransferenceTransactionRepository } from "test/repositories/in-memory-transference-transaction.repository";
import { dayInMilliseconds } from "test/utils/day-in-milliseconds";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";
import { CreateTransferenceTransactionUseCase } from "./create-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let jobScheduling: InMemoryJobScheduling;
let unitOfWork: FakeUnitOfWork;
let createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;

let sut: CreateTransferenceTransactionUseCase;

let userId: string;
let originBankAccount: ReturnType<typeof makeBankAccount>;
let destinyBankAccount: ReturnType<typeof makeBankAccount>;
let transferenceTransaction: ReturnType<typeof makeTransferenceTransaction>;

describe("[Use Case] Create transference transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transferenceTransactionRepository =
      new InMemoryTransferenceTransactionRepository({ bankAccountRepository });
    jobScheduling = new InMemoryJobScheduling();
    unitOfWork = new FakeUnitOfWork();
    createTransactionRecurrenceUseCase = new CreateTransactionRecurrenceUseCase(
      {
        jobScheduling,
        transactionRecurrenceRepository: transferenceTransactionRepository,
        unitOfWork,
      },
    );

    sut = new CreateTransferenceTransactionUseCase({
      bankAccountRepository,
      transferenceTransactionRepository,
      jobScheduling,
      unitOfWork,
      createTransactionRecurrenceUseCase,
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

  it("should be able to create a transference transaction that will be carried out in the future", async () => {
    const daysToFirstTransactionOccur = 2;
    const transactedAt = new Date(
      new Date().getTime() + dayInMilliseconds(daysToFirstTransactionOccur),
    );

    const { isRight, result } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      transactedAt,
    });

    expect(isRight()).toBeTruthy();
    expect(transferenceTransactionRepository.items[0]).toEqual(
      result.transferenceTransaction,
    );

    const transactionDateInStartOfDay = new Date(
      transactedAt.getFullYear(),
      transactedAt.getMonth(),
      transactedAt.getDate(),
    );

    expect(transferenceTransactionRepository.items[0].transactedAt).toEqual(
      transactionDateInStartOfDay,
    );
  });

  it("should be able to accomplish transaction when has been marked if paid", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      amount,
      isAccomplished: true,
    });

    expect(isRight()).toBeTruthy();
    expect(
      transferenceTransactionRepository.items[0].isAccomplished,
    ).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance - amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance + amount,
    );
  });

  it("should not be able to accomplish transaction when has been not marked if transferred", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;
    const amount = 50;

    const { isRight } = await sut.execute<"success">({
      userId,
      ...transferenceTransaction.input,
      amount,
      isAccomplished: false,
    });

    expect(isRight()).toBeTruthy();
    expect(
      transferenceTransactionRepository.items[0].isAccomplished,
    ).toBeFalsy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance,
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
    const originBankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(originBankAccountFromAnotherUser.entity);

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      originBankAccountId: originBankAccountFromAnotherUser.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to create a transference transaction with a destiny bank account that does not belong to the user", async () => {
    const destinyBankAccountFromAnotherUser = makeBankAccount({
      userId: faker.string.uuid(),
    });

    await bankAccountRepository.create(
      destinyBankAccountFromAnotherUser.entity,
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      ...transferenceTransaction.input,
      destinyBankAccountId: destinyBankAccountFromAnotherUser.entity.id.value,
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
          length: { min: 256, max: 300 },
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
