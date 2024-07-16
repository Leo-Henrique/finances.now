import { BaseRepository } from "@/core/repositories/base-repository";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated,
  CreditExpenseTransactionEntity,
} from "../entities/credit-expense-transaction.entity";
import { TransactionRecurrenceRepository } from "./transaction-recurrence.repository";

type CoreOperationsCreditExpenseTransactionRepository = BaseRepository<
  CreditExpenseTransactionEntity,
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated
>;

export type UpdateManyAccomplishedCreditExpenseTransactionsData = Pick<
  CreditExpenseTransactionDataUpdated,
  "categoryId" | "description"
>;

export type UpdateManyPendingCreditExpenseTransactionsData = Pick<
  CreditExpenseTransactionDataUpdated,
  "categoryId" | "description" | "amount"
>;

export interface CreditExpenseTransactionRepository
  extends CoreOperationsCreditExpenseTransactionRepository,
    TransactionRecurrenceRepository<CreditExpenseTransaction> {
  findUniqueFromUserById(
    userId: string,
    creditExpenseTransactionId: string,
  ): Promise<CreditExpenseTransaction | null>;
  updateManyAccomplished(
    originTransaction: CreditExpenseTransaction,
    data: UpdateManyAccomplishedCreditExpenseTransactionsData,
  ): Promise<void>;
  updateManyPending(
    originTransaction: CreditExpenseTransaction,
    data: UpdateManyPendingCreditExpenseTransactionsData,
  ): Promise<void>;
}
