import { BaseRepository } from "@/core/repositories/base-repository";
import {
  TransactionCategory,
  TransactionCategoryDataUpdated,
  TransactionCategoryEntity,
} from "../entities/transaction-category.entity";

type CoreOperationsTransactionCategoryRepository = BaseRepository<
  TransactionCategoryEntity,
  TransactionCategory,
  TransactionCategoryDataUpdated
>;

export interface TransactionCategoryRepository
  extends CoreOperationsTransactionCategoryRepository {
  findUniqueFromUserById(
    userId: string,
    transactionCategoryId: string,
  ): Promise<TransactionCategory | null>;
  findManyFromUserOfExpenses(userId: string): Promise<TransactionCategory[]>;
  findManyFromUserOfEarning(userId: string): Promise<TransactionCategory[]>;
}
