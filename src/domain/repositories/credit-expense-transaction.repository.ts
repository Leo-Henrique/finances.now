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

export interface CreditExpenseTransactionRepository
  extends CoreOperationsCreditExpenseTransactionRepository,
    TransactionRecurrenceRepository<CreditExpenseTransaction> {}
