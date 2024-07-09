import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";

export const transferenceTransactionsNumberPerTimeInRecurrence = 500;

type InMemoryTransferenceTransactionRepositoryDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class InMemoryTransferenceTransactionRepository
  extends InMemoryBaseRepository<
    TransferenceTransactionEntity,
    TransferenceTransaction,
    TransferenceTransactionDataUpdated
  >
  implements TransferenceTransactionRepository
{
  public constructor(
    private deps: InMemoryTransferenceTransactionRepositoryDeps,
  ) {
    super();
  }

  public async createManyOfRecurrence(
    originTransaction: TransferenceTransaction,
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
      (recurrenceLimit ?? transferenceTransactionsNumberPerTimeInRecurrence);
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

    const transaction = TransferenceTransactionEntity.create({
      originId: originTransaction.id,
      originBankAccountId: originTransaction.originBankAccountId.value,
      destinyBankAccountId: originTransaction.destinyBankAccountId.value,
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
        (transferenceTransactionsNumberPerTimeInRecurrence / 2 + 1)
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
    debitExpenseTransactionId: string,
  ) {
    const debitExpenseTransaction = this.items.find(item => {
      return item.id.value === debitExpenseTransactionId;
    });

    if (!debitExpenseTransaction) return null;

    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        debitExpenseTransaction.originBankAccountId.value,
      );

    if (!bankAccount) return null;

    return debitExpenseTransaction;
  }
}
