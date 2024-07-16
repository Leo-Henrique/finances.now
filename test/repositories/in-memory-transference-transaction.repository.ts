import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import {
  TransferenceTransactionRepository,
  UpdateManyAccomplishedTransferenceTransactionsData,
  UpdateManyPendingTransferenceTransactionsData,
} from "@/domain/repositories/transference-transaction.repository";

export const IN_MEMORY_COUNT_BATCH_TRANSFERENCE_TRANSACTIONS_IN_RECURRENCE = 100;

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
      (recurrenceLimit ??
        IN_MEMORY_COUNT_BATCH_TRANSFERENCE_TRANSACTIONS_IN_RECURRENCE);
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

    let index =
      recurringTransactions.length -
      (IN_MEMORY_COUNT_BATCH_TRANSFERENCE_TRANSACTIONS_IN_RECURRENCE / 2 + 1);

    if (index < 1) index = recurringTransactions.length / 2 + 1;

    return recurringTransactions[Math.floor(index)];
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
    transferenceTransactionId: string,
  ) {
    const transferenceTransaction = this.items.find(item => {
      return item.id.value === transferenceTransactionId;
    });

    if (!transferenceTransaction) return null;

    const originBankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        transferenceTransaction.originBankAccountId.value,
      );

    const destinyBankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        transferenceTransaction.destinyBankAccountId.value,
      );

    if (!originBankAccount || !destinyBankAccount) return null;

    return transferenceTransaction;
  }

  public async findUniqueOriginTransactionById(transactionId: string) {
    const transferenceTransaction = this.items.find(item => {
      return item.id.value === transactionId;
    });

    if (!transferenceTransaction) return null;

    const originTransaction = this.items.find(item => {
      return item.id.value === transferenceTransaction.originId?.value;
    });

    if (originTransaction) return originTransaction;

    if (transferenceTransaction.recurrencePeriod)
      return transferenceTransaction;

    return null;
  }

  public async updateManyAccomplished(
    originTransaction: TransferenceTransaction,
    data: UpdateManyAccomplishedTransferenceTransactionsData,
  ) {
    const transactions = this.items.filter(item => {
      const matchIds =
        item.id.value === originTransaction.id.value ||
        item.originId?.value === originTransaction.id.value;

      return matchIds && item.isAccomplished === true;
    });

    for (const transaction of transactions) {
      const transactionIndex = this.items.findIndex(
        item => item.id.value === transaction.id.value,
      );

      if (transactionIndex < 0) continue;

      for (const fieldName in data) {
        // @ts-expect-error: current field inference is unknown
        this.items[transactionIndex][fieldName] = data[fieldName];
      }
    }
  }

  public async updateManyPending(
    originTransaction: TransferenceTransaction,
    data: UpdateManyPendingTransferenceTransactionsData,
  ) {
    const transactions = this.items.filter(item => {
      const matchIds =
        item.id.value === originTransaction.id.value ||
        item.originId?.value === originTransaction.id.value;

      return matchIds && item.isAccomplished === false;
    });

    for (const transaction of transactions) {
      const transactionIndex = this.items.findIndex(
        item => item.id.value === transaction.id.value,
      );

      if (transactionIndex < 0) continue;

      for (const fieldName in data) {
        // @ts-expect-error: current field inference is unknown
        this.items[transactionIndex][fieldName] = data[fieldName];
      }
    }
  }
}
