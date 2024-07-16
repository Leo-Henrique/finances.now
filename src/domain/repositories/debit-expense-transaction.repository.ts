import { BaseRepository } from "@/core/repositories/base-repository";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated,
  DebitExpenseTransactionEntity,
} from "../entities/debit-expense-transaction.entity";
import { TransactionRepository } from "./transaction.repository";

type CoreOperationsDebitExpenseTransactionRepository = BaseRepository<
  DebitExpenseTransactionEntity,
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated
>;

export type UpdateManyAccomplishedDebitExpenseTransactionsData = Pick<
  DebitExpenseTransactionDataUpdated,
  "categoryId" | "description"
>;

export type UpdateManyPendingDebitExpenseTransactionsData = Pick<
  DebitExpenseTransactionDataUpdated,
  "categoryId" | "description" | "amount"
>;

type DebitExpenseTransactionRecurrenceRepository = TransactionRepository<
  DebitExpenseTransaction,
  UpdateManyAccomplishedDebitExpenseTransactionsData,
  UpdateManyPendingDebitExpenseTransactionsData
>;

export interface DebitExpenseTransactionRepository
  extends CoreOperationsDebitExpenseTransactionRepository,
    DebitExpenseTransactionRecurrenceRepository {
  deleteManyAccomplished(
    originTransaction: DebitExpenseTransaction,
  ): Promise<void>;
}
