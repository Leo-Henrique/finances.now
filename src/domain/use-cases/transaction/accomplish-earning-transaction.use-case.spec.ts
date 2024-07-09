import { ValidationError } from "@/core/errors/errors";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeEarningTransaction } from "test/factories/make-earning-transaction";
import { FakeUnitOfWork } from "test/gateways/fake-unit-of-work";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryEarningTransactionRepository } from "test/repositories/in-memory-earning-transaction.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { AccomplishEarningTransactionUseCase } from "./accomplish-earning-transaction.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let earningTransactionRepository: InMemoryEarningTransactionRepository;
let unitOfWork: FakeUnitOfWork;

let sut: AccomplishEarningTransactionUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;
let earningTransaction: ReturnType<typeof makeEarningTransaction>;

describe("[Use Case] Accomplish earning transaction", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    earningTransactionRepository = new InMemoryEarningTransactionRepository({
      bankAccountRepository,
    });
    unitOfWork = new FakeUnitOfWork();

    sut = new AccomplishEarningTransactionUseCase({
      bankAccountRepository,
      earningTransactionRepository,
      unitOfWork,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    earningTransaction = makeEarningTransaction({
      bankAccountId: bankAccount.entity.id.value,
      categoryId: faker.string.uuid(),
    });

    await bankAccountRepository.create(bankAccount.entity);
    await earningTransactionRepository.create(earningTransaction.entity);
  });

  it("should be able to accomplish earning transaction", async () => {
    const bankAccountBalance = bankAccountRepository.items[0].balance;

    const { isRight, result } = await sut.execute<"success">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.earningTransaction.id).toEqual(earningTransaction.entity.id);
    expect(earningTransactionRepository.items[0].isAccomplished).toBeTruthy();
    expect(bankAccountRepository.items[0].balance).toEqual(
      bankAccountBalance + earningTransaction.entity.amount,
    );
  });

  it("should not be able to accomplish a non-existent earning transaction", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      earningTransactionId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a earning transaction if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      earningTransactionId: earningTransaction.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to accomplish a earning transaction when already accomplished", async () => {
    await earningTransactionRepository.update(earningTransaction.entity, {
      isAccomplished: true,
    });

    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      earningTransactionId: earningTransaction.entity.id.value,
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
        earningTransactionId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
