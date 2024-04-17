import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { GetBankAccountUseCase } from "./get-bank-account.use-case";

let bankAccountRepository: InMemoryBankAccountRepository;
let sut: GetBankAccountUseCase;
let userId: string;
let bankAccount: ReturnType<typeof makeBankAccount>;

describe("[Use Case] Get bank account", () => {
  beforeEach(async () => {
    bankAccountRepository = new InMemoryBankAccountRepository();
    sut = new GetBankAccountUseCase({
      bankAccountRepository,
    });

    userId = faker.string.uuid();
    bankAccount = makeBankAccount({ userId });

    await bankAccountRepository.create(bankAccount.entity);
  });

  it("should be able to get bank account", async () => {
    const { isRight, result } = await sut.execute<"success">({
      bankAccountId: bankAccount.entity.id.value,
      userId,
    });

    expect(isRight()).toBeTruthy();
    expect(result.bankAccount).toMatchObject(bankAccount.entity);
  });

  it("should not be able to get a non-existent bank account", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      bankAccountId: faker.string.uuid(),
      userId,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to get an bank account if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      bankAccountId: bankAccount.entity.id.value,
      userId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(UnauthorizedError);
  });
});
