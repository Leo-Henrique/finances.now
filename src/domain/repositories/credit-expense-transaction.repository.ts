import { BaseRepository } from "@/core/repositories/base-repository";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated,
  CreditExpenseTransactionEntity,
} from "../entities/credit-expense-transaction.entity";

type CoreOperationsCreditExpenseTransactionRepository = BaseRepository<
  CreditExpenseTransactionEntity,
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated
>;

export interface CreditExpenseTransactionRepository
  extends CoreOperationsCreditExpenseTransactionRepository {
  createManyOfRecurrence(
    originTransaction: CreditExpenseTransaction,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<CreditExpenseTransaction | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<CreditExpenseTransaction | null>;
}
