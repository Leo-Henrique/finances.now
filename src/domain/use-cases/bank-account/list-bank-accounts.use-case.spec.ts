import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ListBankAccountsUseCase,
  ListBankAccountsUseCaseInput,
} from "./list-bank-accounts.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;

let sut: ListBankAccountsUseCase;

let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;

const input: ListBankAccountsUseCaseInput = {
  userId: faker.string.uuid(),
  items: 10,
  page: 1,
};

describe("[Use Case] List bank accounts", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();

    sut = new ListBankAccountsUseCase({
      bankAccountRepository,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });
    input.userId = userId;

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should be able to list bank accounts", async () => {
    for (let i = 1; i <= 2; i++)
      await bankAccountRepository.create(bankAccount.entity);

    const { isRight, result } = await sut.execute<"success">(input);

    expect(isRight()).toBeTruthy();
    expect(result.bankAccounts).toHaveLength(2);
    expect(result.total).toEqual(2);

    for (const bankAccount of result.bankAccounts)
      expect(bankAccount.userId.value).toEqual(userId);
  });

  it("should be able to list only the owner user bank accounts", async () => {
    for (let i = 1; i <= 3; i++) {
      await bankAccountRepository.create({
        ...bankAccount.entity,
        userId: new UniqueEntityId(),
      });
    }

    for (let i = 1; i <= 2; i++)
      await bankAccountRepository.create(bankAccount.entity);

    const { isRight, result } = await sut.execute<"success">(input);

    expect(isRight()).toBeTruthy();
    expect(result.bankAccounts).toHaveLength(2);
    expect(result.total).toEqual(2);

    for (const bankAccount of result.bankAccounts)
      expect(bankAccount.userId.value).toEqual(userId);
  });

  it("should be able to list bank accounts with pagination", async () => {
    const items = 10;
    const itemsInLastPage = 2;
    const totalItems = items + itemsInLastPage;

    for (let i = 1; i <= totalItems; i++)
      await bankAccountRepository.create(bankAccount.entity);

    const { isRight, result } = await sut.execute<"success">({
      ...input,
      items,
      page: 2,
    });

    expect(isRight()).toBeTruthy();
    expect(result.bankAccounts).toHaveLength(itemsInLastPage);
    expect(result.total).toEqual(totalItems);
  });

  it("should be able to list bank accounts sorted from most oldest to recent", async () => {
    for (let i = 1; i <= 4; i++) {
      await bankAccountRepository.create({
        ...bankAccount.entity,
        createdAt: new Date(),
      });

      vi.advanceTimersByTime(1000 * 60);
    }

    const { isRight, result } = await sut.execute<"success">(input);

    expect(isRight()).toBeTruthy();
    expect(result.bankAccounts).toEqual(
      result.bankAccounts.map((bankAccount, index, list) => {
        const nextBankAccount = list[index + 1];

        if (nextBankAccount) {
          expect(bankAccount.createdAt.getTime()).toBeLessThan(
            nextBankAccount.createdAt.getTime(),
          );
        }

        return expect.objectContaining({ createdAt: expect.any(Date) });
      }),
    );
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to list bank account with invalid items", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...input,
        items: 100,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to list bank account with invalid page", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...input,
        page: 0,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
