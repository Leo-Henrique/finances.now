import { BaseRepository } from "@/core/repositories/base-repository";
import {
  CreditCardExpenseTransaction,
  CreditCardExpenseTransactionDataUpdated,
  CreditCardExpenseTransactionEntity,
} from "../entities/credit-card-expense-transaction";

type CoreOperationsCreditCardExpenseTransactionRepository = BaseRepository<
  CreditCardExpenseTransactionEntity,
  CreditCardExpenseTransaction,
  CreditCardExpenseTransactionDataUpdated
>;

export interface CreditCardExpenseTransactionRepository
  extends CoreOperationsCreditCardExpenseTransactionRepository {}
