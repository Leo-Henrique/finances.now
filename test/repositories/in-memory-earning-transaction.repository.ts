import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";

export const recurrenceLimitDefaultPart = 100;

export class InMemoryEarningTransactionRepository
  extends InMemoryBaseRepository<
    EarningTransactionEntity,
    EarningTransaction,
    EarningTransactionDataUpdated
  >
  implements EarningTransactionRepository
{
  public async createManyOfRecurrence(
    originTransaction: EarningTransaction,
    lastTransactedDate?: Date,
  ) {
    const { recurrencePeriod, recurrenceLimit, recurrenceAmount } =
      originTransaction;
    const baseTransactedDate =
      lastTransactedDate ?? originTransaction.transactedAt;

    if (!recurrencePeriod) return;

    const recurrenceTransactions: EarningTransaction[] = [];

    for (
      let currentRecurrence = 1;
      currentRecurrence <= (recurrenceLimit ?? recurrenceLimitDefaultPart);
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

      const transaction = EarningTransactionEntity.create({
        originId: originTransaction.id,
        bankAccountId: originTransaction.bankAccountId.value,
        categoryId: originTransaction.categoryId.value,
        description: originTransaction.description,
        transactedAt: new Date(year, month, day),
        amount: originTransaction.amount,
      });

      recurrenceTransactions.push(transaction);
    }

    await Promise.all(
      recurrenceTransactions.map(transaction => this.create(transaction)),
    );
  }

  public async findUniqueMiddleOfCurrentRecurrence(originId: string) {
    const recurringTransactions = this.items.filter(item => {
      return item.originId?.value === originId;
    });

    if (!recurringTransactions.length) return null;

    return recurringTransactions[
      recurringTransactions.length - (recurrenceLimitDefaultPart / 2 + 1)
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
