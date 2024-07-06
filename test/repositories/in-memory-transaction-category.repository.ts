import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  TransactionCategory,
  TransactionCategoryDataUpdated,
  TransactionCategoryEntity,
} from "@/domain/entities/transaction-category.entity";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { makeTransactionCategory } from "test/factories/make-transaction-category";

export class InMemoryTransactionCategoryRepository
  extends InMemoryBaseRepository<
    TransactionCategoryEntity,
    TransactionCategory,
    TransactionCategoryDataUpdated
  >
  implements TransactionCategoryRepository
{
  public constructor() {
    super();

    for (let i = 1; i <= 10; i++) {
      const { entity } = makeTransactionCategory({
        isInExpense: i > 5,
      });

      this.create(entity);
    }
  }

  public async findUniqueFromUserById(
    userId: string,
    transactionCategoryId: string,
  ) {
    const transactionCategory = this.items.find(item => {
      return (
        (item.userId?.value === userId || item.userId === null) &&
        item.id.value === transactionCategoryId
      );
    });

    if (!transactionCategory) return null;

    return transactionCategory;
  }

  public async findManyFromUserOfExpenses(userId: string) {
    const transactionCategories = this.items
      .filter(item => {
        return (
          (item.userId?.value === userId || item.userId === null) &&
          item.isInExpense
        );
      })
      .sort((a, b) => {
        if (a.name.value.toLowerCase() < b.name.value.toLowerCase()) return -1;

        if (a.name.value.toLowerCase() > b.name.value.toLowerCase()) return 1;

        return 0;
      });

    return transactionCategories;
  }

  public async findManyFromUserOfEarning(userId: string) {
    const transactionCategories = this.items
      .filter(item => {
        return (
          (item.userId?.value === userId || item.userId === null) &&
          !item.isInExpense
        );
      })
      .sort((a, b) => {
        if (a.name.value.toLowerCase() < b.name.value.toLowerCase()) return -1;

        if (a.name.value.toLowerCase() > b.name.value.toLowerCase()) return 1;

        return 0;
      });

    return transactionCategories;
  }
}
