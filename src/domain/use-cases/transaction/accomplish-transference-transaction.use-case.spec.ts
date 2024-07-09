import { ValidationError } from "@/core/errors/errors";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeTransferenceTransaction } from "test/factories/make-transference-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryTransferenceTransactionRepository } from "test/repositories/in-memory-transference-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AccomplishTransferenceTransactionUseCase } from "./accomplish-transference-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let transferenceTransactionRepository: InMemoryTransferenceTransactionRepository;
let unitOfWork: FakeUnitOfWork;

let sut: AccomplishTransferenceTransactionUseCase;

let userId: string;
let originBankAccount: ReturnType<typeof makeBankAccount>;
let destinyBankAccount: ReturnType<typeof makeBankAccount>;
let transferenceTransaction: ReturnType<typeof makeTransferenceTransaction>;

describe("[Use Case] Accomplish transference transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    transferenceTransactionRepository =
      new InMemoryTransferenceTransactionRepository({
        bankAccountRepository,
      });
    unitOfWork = new FakeUnitOfWork();

    sut = new AccomplishTransferenceTransactionUseCase({
      bankAccountRepository,
      transferenceTransactionRepository,
      unitOfWork,
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
    await transferenceTransactionRepository.create(
      transferenceTransaction.entity,
    );
  });

  it("should be able to accomplish transference transaction", async () => {
    const originBankAccountBalance = bankAccountRepository.items[0].balance;
    const destinyBankAccountBalance = bankAccountRepository.items[1].balance;

    const { isRight, result } = await sut.execute<"success">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transferenceTransaction.id).toEqual(
      transferenceTransaction.entity.id,
    );
    expect(
      transferenceTransactionRepository.items[0].isAccomplished,
    ).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      originBankAccountBalance - transferenceTransaction.entity.amount,
    );
    expect(bankAccountRepository.items[1].balance).toEqual(
      destinyBankAccountBalance + transferenceTransaction.entity.amount,
    );
  });

  it("should not be able to accomplish a non-existent transference transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      transferenceTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a transference transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      transferenceTransactionId: transferenceTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a transference transaction when already accomplished", async () => {
    await transferenceTransactionRepository.update(
      transferenceTransaction.entity,
      {
        isAccomplished: true,
      },
    );

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      transferenceTransactionId: transferenceTransaction.entity.id.value,
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
        transferenceTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
