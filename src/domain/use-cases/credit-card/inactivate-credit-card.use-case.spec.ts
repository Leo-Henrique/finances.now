import { ValidationError } from "@/core/errors/errors";
import { ResourceNotFoundError } from "@/domain/errors";
import { faker } from "@faker-js/faker";
import { makeCreditCard } from "test/factories/make-credit-card";
import { InMemoryCreditCardRepository } from "test/repositories/in-memory-credit-card.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { InactivateCreditCardUseCase } from "./inactivate-credit-card.use-case";

let creditCardRepository: InMemoryCreditCardRepository;

let sut: InactivateCreditCardUseCase;

let userId: string;
let creditCard: ReturnType<typeof makeCreditCard>;

describe("[Use Case] Inactivate credit card", () => {
  beforeEach(async () => {
    creditCardRepository = new InMemoryCreditCardRepository();

    sut = new InactivateCreditCardUseCase({
      creditCardRepository,
    });

    userId = faker.string.uuid();
    creditCard = makeCreditCard({ userId, bankAccountId: faker.string.uuid() });

    await creditCardRepository.create(creditCard.entity);
  });

  it("should be able to inactivate a credit card", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      creditCardId: creditCard.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.creditCard.id.value).toEqual(creditCard.entity.id.value);
    expect(creditCardRepository.items[0].inactivatedAt).toBeInstanceOf(Date);
  });

  it("should be able to reactivate a credit card", async () => {
    await sut.execute<"success">({
      userId,
      creditCardId: creditCard.entity.id.value,
    });

    const { isRight, result } = await sut.execute<"success">({
      userId,
      creditCardId: creditCard.entity.id.value,
    });

    expect(isRight()).toBeTruthy();
    expect(result.creditCard.id.value).toEqual(creditCard.entity.id.value);
    expect(creditCardRepository.items[0].inactivatedAt).toBeNull();
  });

  it("should not be able to inactivate a non-existent credit card", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId,
      creditCardId: faker.string.uuid(),
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  it("should not be able to inactivate a credit card if the user is not the owner", async () => {
    const { isLeft, reason } = await sut.execute<"error">({
      userId: faker.string.uuid(),
      creditCardId: creditCard.entity.id.value,
    });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(ResourceNotFoundError);
  });

  describe("[Business Roles] given invalid input", () => {
    it("should not be able to inactivate a credit card without required input fields", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: field is required
        userId: undefined,
        // @ts-expect-error: field is required
        creditCardId: undefined,
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });
  });
});
