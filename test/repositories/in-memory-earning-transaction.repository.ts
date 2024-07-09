import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";

export const earningTransactionsNumberPerTimeInRecurrence = 500;

type InMemoryEarningTransactionRepositoryDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class InMemoryEarningTransactionRepository
  extends InMemoryBaseRepository<
    EarningTransactionEntity,
    EarningTransaction,
    EarningTransactionDataUpdated
  >
  implements EarningTransactionRepository
{
  public constructor(private deps: InMemoryEarningTransactionRepositoryDeps) {
    super();
  }

  public async createManyOfRecurrence(
    originTransaction: EarningTransaction,
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
      (recurrenceLimit ?? earningTransactionsNumberPerTimeInRecurrence);
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

    const transaction = EarningTransactionEntity.create({
      originId: originTransaction.id,
      bankAccountId: originTransaction.bankAccountId.value,
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
        (earningTransactionsNumberPerTimeInRecurrence / 2 + 1)
    ];
  }

  public async findUniqueEndOfCurrentRecurrence(originId: string) {
    const recurringTransactions = this.items.filter(item => {
      return item.originId?.value === originId;
    });

    if (!recurringTransactions.length) return null;

    return recurringTransactions[recurringTransactions.length - 1];
  }

  public async findUniqueFromUserById(
    userId: string,
    earningTransactionId: string,
  ) {
    const earningTransaction = this.items.find(item => {
      return item.id.value === earningTransactionId;
    });

    if (!earningTransaction) return null;

    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        earningTransaction.bankAccountId.value,
      );

    if (!bankAccount) return null;

    return earningTransaction;
  }
}
