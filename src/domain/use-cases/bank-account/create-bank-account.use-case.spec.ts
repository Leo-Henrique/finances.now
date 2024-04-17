import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeBankAccount } from "test/factories/make-bank-account";
import { makeUser } from "test/factories/make-user";
import { InMemoryBankAccountRepository } from "test/repositories/in-memory-bank-account.repository";
import { InMemoryUserRepository } from "test/repositories/in-memory-user.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { CreateBankAccountUseCase } from "./create-bank-account.use-case";

let userRepository: InMemoryUserRepository;
let bankAccountRepository: InMemoryBankAccountRepository;
let sut: CreateBankAccountUseCase;
let user: ReturnType<typeof makeUser>;
let bankAccount: ReturnType<typeof makeBankAccount>;

describe("[Use Case] Create bank account", () => {
  beforeEach(async () => {
    userRepository = new InMemoryUserRepository();
    bankAccountRepository = new InMemoryBankAccountRepository();
    sut = new CreateBankAccountUseCase({
      userRepository,
      bankAccountRepository,
    });
    user = makeUser();
    bankAccount = makeBankAccount({ userId: user.entity.id.value });

    await userRepository.create(user.entity);
  });

  it("should be able to create an bank account", async () => {
    const { isRight, result } = await sut.execute<"success">(bankAccount.input);

    expect(isRight()).toBeTruthy();
    expect(result.bankAccount.userId).toEqual(user.entity.id);
    expect(result.bankAccount.userId).toEqual(bankAccount.entity.userId);
    expect(bankAccountRepository.items[0]).toEqual(result.bankAccount);
  });

  it("should not be able to create an bank account for non-existent user", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      ...bankAccount.input,
      userId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should be able to create an bank account without optional input fields", async () => {
      const { isRight, result } = await sut.execute<"success">({
        ...bankAccount.input,
        description: undefined,
        balance: undefined,
        mainAccount: undefined,
      });

      expect(isRight()).toBeTruthy();
      expect(result.bankAccount.description).toBeNull();
      expect(result.bankAccount.balance).toEqual(0);
      expect(result.bankAccount.mainAccount).toEqual(false);
    });

    it("should not be able to create an bank account without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        ...bankAccount.input,
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        institution: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should not be able to create an bank account with invalid balance", async () => {
      const stringBalanceResult = await sut.execute<"error">({
        ...bankAccount.input,
        // @ts-expect-error: expect number
        balance: "50",
      });

      expect(stringBalanceResult.isLeft()).toBeTruthy();
      expect(stringBalanceResult.reason).toBeInstanceOf(ValidationError);

      const negativeBalanceResult = await sut.execute<"error">({
        ...bankAccount.input,
        balance: -50,
      });

      expect(negativeBalanceResult.isLeft()).toBeTruthy();
      expect(negativeBalanceResult.reason).toBeInstanceOf(ValidationError);
    });
  });
});
