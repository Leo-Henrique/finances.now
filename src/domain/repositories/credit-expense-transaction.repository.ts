import { BaseRepository } from "@/core/repositories/base-repository";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated,
  CreditExpenseTransactionEntity,
} from "../entities/credit-expense-transaction.entity";
import { TransactionRepository } from "./transaction.repository";

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

type CreditExpenseTransactionRecurrenceRepository = TransactionRepository<
  CreditExpenseTransaction,
  UpdateManyAccomplishedCreditExpenseTransactionsData,
  UpdateManyPendingCreditExpenseTransactionsData
>;

export interface CreditExpenseTransactionRepository
  extends CoreOperationsCreditExpenseTransactionRepository,
    CreditExpenseTransactionRecurrenceRepository {}
