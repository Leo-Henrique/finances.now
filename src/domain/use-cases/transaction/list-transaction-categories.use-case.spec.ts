import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { faker } from "@faker-js/faker";
import { makeTransactionCategory } from "test/factories/make-transaction-category";
import { InMemoryTransactionCategoryRepository } from "test/repositories/in-memory-transaction-category.repository";
import { beforeEach, describe, expect, it } from "vitest";
import { ListTransactionCategoriesUseCase } from "./list-transaction-categories.use-case";

let transactionCategoryRepository: InMemoryTransactionCategoryRepository;
let sut: ListTransactionCategoriesUseCase;
let userId: string;

describe("[Use Case] List transaction categories", () => {
  beforeEach(async () => {
    transactionCategoryRepository = new InMemoryTransactionCategoryRepository();
    sut = new ListTransactionCategoriesUseCase({
      transactionCategoryRepository,
    });
    userId = faker.string.uuid();
  });

  it("should be able to list expense transaction categories that are default", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      expensesOnly: true,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transactionCategories).toHaveLength(5);
    expect(result.transactionCategories).toEqual(
      result.transactionCategories.map(() => {
        return expect.objectContaining({ userId: null, isInExpense: true });
      }),
    );
  });

  it("should be able to list earning transaction categories that are default", async () => {
    const { isRight, result } = await sut.execute<"success">({
      userId,
      expensesOnly: false,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transactionCategories).toHaveLength(5);
    expect(result.transactionCategories).toEqual(
      result.transactionCategories.map(() => {
        return expect.objectContaining({ userId: null, isInExpense: false });
      }),
    );
  });

  it("should be able to list expense transaction categories are created by user and that are default", async () => {
    const transactionCategoriesFromUserCount = 3;

    for (let i = 1; i <= transactionCategoriesFromUserCount; i++) {
      const transactionCategory = makeTransactionCategory({
        userId,
        isInExpense: true,
        name: "zzz-" + faker.lorem.word(),
      });

      await transactionCategoryRepository.create(transactionCategory.entity);
    }

    const { isRight, result } = await sut.execute<"success">({
      userId,
      expensesOnly: true,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transactionCategories).toHaveLength(
      5 + transactionCategoriesFromUserCount,
    );
    expect(result.transactionCategories).toEqual(
      result.transactionCategories.map((_, i) => {
        return expect.objectContaining({
          userId: i > 4 ? new UniqueEntityId(userId) : null,
          isInExpense: true,
        });
      }),
    );
  });

  it("should be able to list earning transaction categories are created by user and that are default", async () => {
    const transactionCategoriesFromUserCount = 3;

    for (let i = 1; i <= transactionCategoriesFromUserCount; i++) {
      const transactionCategory = makeTransactionCategory({
        userId,
        isInExpense: false,
        name: "zzz-" + faker.lorem.word(),
      });

      await transactionCategoryRepository.create(transactionCategory.entity);
    }

    const { isRight, result } = await sut.execute<"success">({
      userId,
      expensesOnly: false,
    });

    expect(isRight()).toBeTruthy();
    expect(result.transactionCategories).toHaveLength(
      5 + transactionCategoriesFromUserCount,
    );
    expect(result.transactionCategories).toEqual(
      result.transactionCategories.map((_, i) => {
        return expect.objectContaining({
          userId: i > 4 ? new UniqueEntityId(userId) : null,
          isInExpense: false,
        });
      }),
    );
  });
});
