import { ValidationError } from "@/core/errors/errors";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeDebitExpenseTransaction } from "test/factories/make-debit-expense-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryDebitExpenseTransactionRepository } from "test/repositories/in-memory-debit-expense-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AccomplishDebitExpenseTransactionUseCase } from "./accomplish-debit-expense-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let debitExpenseTransactionRepository: InMemoryDebitExpenseTransactionRepository;
let unitOfWork: FakeUnitOfWork;

let sut: AccomplishDebitExpenseTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let debitExpenseTransaction: ReturnType<typeof makeDebitExpenseTransaction>;

describe("[Use Case] Accomplish debit expense transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    debitExpenseTransactionRepository =
      new InMemoryDebitExpenseTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();

    sut = new AccomplishDebitExpenseTransactionUseCase({
      bankAccountRepository,
      debitExpenseTransactionRepository,
      unitOfWork,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    debitExpenseTransaction = makeDebitExpenseTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccount.entity);
    await debitExpenseTransactionRepository.create(
      debitExpenseTransaction.entity,
    );
  });

  it("should be able to accomplish debit expense transaction", async () => {
    const bankAccountBalance = bankAccountRepository.items[0].balance;

    const { isRight, result } = await sut.execute<"success">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.debitExpenseTransaction.id).toEqual(
      debitExpenseTransaction.entity.id,
    );
    expect(
      debitExpenseTransactionRepository.items[0].isAccomplished,
    ).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccountBalance - debitExpenseTransaction.entity.amount,
    );
  });

  it("should not be able to accomplish a non-existent debit expense transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      debitExpenseTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a debit expense transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a debit expense transaction when already accomplished", async () => {
    await debitExpenseTransactionRepository.update(
      debitExpenseTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      debitExpenseTransactionId: debitExpenseTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(TransactionAlreadyAccomplishedError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to update a bank account without required input fields", async () => {
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
