import { BaseRepository } from "@/core/repositories/base-repository";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated,
  DebitExpenseTransactionEntity,
} from "../entities/debit-expense-transaction.entity";

type CoreOperationsDebitExpenseTransactionRepository = BaseRepository<
  DebitExpenseTransactionEntity,
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated
>;

export interface DebitExpenseTransactionRepository
  extends CoreOperationsDebitExpenseTransactionRepository {
  createManyOfRecurrence(
    originTransaction: DebitExpenseTransaction,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<DebitExpenseTransaction | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<DebitExpenseTransaction | null>;
}
