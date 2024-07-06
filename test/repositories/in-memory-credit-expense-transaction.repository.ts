import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";
import { CreditExpenseTransactionRepository } from "@/domain/repositories/credit-expense-transaction.repository";

export const creditExpenseTransactionsNumberPerTimeInRecurrence = 500;

export class InMemoryCreditExpenseTransactionRepository
  extends InMemoryBaseRepository<
    CreditExpenseTransactionEntity,
    CreditExpenseTransaction,
    CreditExpenseTransactionDataUpdated
  >
  implements CreditExpenseTransactionRepository
{
  public async createManyOfRecurrence(
    originTransaction: CreditExpenseTransaction,
    lastTransactedDate?: Date,
  ) {
    const { recurrencePeriod, recurrenceLimit, recurrenceAmount } =
      originTransaction;
    const baseTransactedDate =
      lastTransactedDate ?? originTransaction.transactedAt;

    if (!recurrencePeriod) return;

    const transactedDates: Date[] = [];

    for (
      let currentRecurrence = 1;
      currentRecurrence <=
      (recurrenceLimit ?? creditExpenseTransactionsNumberPerTimeInRecurrence);
      currentRecurrence++
    ) {
      let [year, month, day] = [
        baseTransactedDate.getFullYear(),
        baseTransactedDate.getMonth(),
        baseTransactedDate.getDate(),
      ];

      if (recurrencePeriod === "day")
        day += (recurrenceAmount ?? 1) * currentRecurrence;

      if (recurrencePeriod === "week")
        day += (recurrenceAmount ?? 7) * currentRecurrence;

      if (recurrencePeriod === "month")
        month += (recurrenceAmount ?? 1) * currentRecurrence;

      if (recurrencePeriod === "year")
        year += (recurrenceAmount ?? 1) * currentRecurrence;

      transactedDates.push(new Date(year, month, day));
    }

    const transaction = CreditExpenseTransactionEntity.create({
      originId: originTransaction.id,
      creditCardId: originTransaction.creditCardId.value,
      categoryId: originTransaction.categoryId.value,
      description: originTransaction.description,
      amount: originTransaction.amount,
      transactedAt: new Date(),
    });

    const createTransactions = transactedDates.map(transactedAt => {
      const recurrenceTransaction = transaction.clone();

      recurrenceTransaction.transactedAt = transactedAt;

      return this.create(recurrenceTransaction);
    });

    await Promise.all(createTransactions);
  }

  public async findUniqueMiddleOfCurrentRecurrence(originId: string) {
    const recurringTransactions = this.items.filter(item => {
      return item.originId?.value === originId;
    });

    if (!recurringTransactions.length) return null;

    return recurringTransactions[
      recurringTransactions.length -
        (creditExpenseTransactionsNumberPerTimeInRecurrence / 2 + 1)
    ];
  }

  public async findUniqueEndOfCurrentRecurrence(originId: string) {
    const recurringTransactions = this.items.filter(item => {
      return item.originId?.value === originId;
    });

    if (!recurringTransactions.length) return null;

    return recurringTransactions[recurringTransactions.length - 1];
  }
}
