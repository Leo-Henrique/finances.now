import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";

export class InMemoryDebitExpenseTransactionRepository
  extends InMemoryBaseRepository<
    DebitExpenseTransactionEntity,
    DebitExpenseTransaction,
    DebitExpenseTransactionDataUpdated
  >
  implements EarningTransactionRepository {}
