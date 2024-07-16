import { BaseRepository } from "@/core/repositories/base-repository";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated,
  DebitExpenseTransactionEntity,
} from "../entities/debit-expense-transaction.entity";
import { TransactionRecurrenceRepository } from "./transaction-recurrence.repository";

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

export interface DebitExpenseTransactionRepository
  extends CoreOperationsDebitExpenseTransactionRepository,
    TransactionRecurrenceRepository<DebitExpenseTransaction> {
  findUniqueFromUserById(
    userId: string,
    debitExpenseTransactionId: string,
  ): Promise<DebitExpenseTransaction | null>;
  updateManyAccomplished(
    originTransaction: DebitExpenseTransaction,
    data: UpdateManyAccomplishedDebitExpenseTransactionsData,
  ): Promise<void>;
  updateManyPending(
    originTransaction: DebitExpenseTransaction,
    data: UpdateManyPendingDebitExpenseTransactionsData,
  ): Promise<void>;
}
