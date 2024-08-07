import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionDataUpdated,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import {
  DebitExpenseTransactionRepository,
  UpdateManyAccomplishedDebitExpenseTransactionsData,
  UpdateManyPendingDebitExpenseTransactionsData,
} from "@/domain/repositories/debit-expense-transaction.repository";

export const IN_MEMORY_COUNT_BATCH_DEBIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE = 100;

type InMemoryDebitExpenseTransactionRepositoryDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class InMemoryDebitExpenseTransactionRepository
  extends InMemoryBaseRepository<
    DebitExpenseTransactionEntity,
    DebitExpenseTransaction,
    DebitExpenseTransactionDataUpdated
  >
  implements DebitExpenseTransactionRepository
{
  public constructor(
    private deps: InMemoryDebitExpenseTransactionRepositoryDeps,
  ) {
    super();
  }

  public async createManyOfRecurrence(
    originTransaction: DebitExpenseTransaction,
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
        IN_MEMORY_COUNT_BATCH_DEBIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE);
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

    const transaction = DebitExpenseTransactionEntity.create({
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

    let index =
      recurringTransactions.length -
      (IN_MEMORY_COUNT_BATCH_DEBIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE / 2 + 1);

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
    debitExpenseTransactionId: string,
  ) {
    const debitExpenseTransaction = this.items.find(item => {
      return item.id.value === debitExpenseTransactionId;
    });

    if (!debitExpenseTransaction) return null;

    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        debitExpenseTransaction.bankAccountId.value,
      );

    if (!bankAccount) return null;

    return debitExpenseTransaction;
  }

  public async findUniqueOriginTransactionById(transactionId: string) {
    const debitExpenseTransaction = this.items.find(item => {
      return item.id.value === transactionId;
    });

    if (!debitExpenseTransaction) return null;

    const originTransaction = this.items.find(item => {
      return item.id.value === debitExpenseTransaction.originId?.value;
    });

    if (originTransaction) return originTransaction;

    if (debitExpenseTransaction.recurrencePeriod)
      return debitExpenseTransaction;

    return null;
  }

  public async updateManyAccomplished(
    originTransaction: DebitExpenseTransaction,
    data: UpdateManyAccomplishedDebitExpenseTransactionsData,
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
    originTransaction: DebitExpenseTransaction,
    data: UpdateManyPendingDebitExpenseTransactionsData,
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

  public async delete(debitExpenseTransaction: DebitExpenseTransaction) {
    const transaction = this.items.findIndex(
      item => item.id.value === debitExpenseTransaction.id.value,
    );

    if (transaction < 0) return;

    this.items.splice(transaction, 1);

    await this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
      debitExpenseTransaction.bankAccountId.value,
      debitExpenseTransaction.amount,
    );
  }

  public async deleteManyAccomplished(
    originTransaction: DebitExpenseTransaction,
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

      await this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
        transaction.bankAccountId.value,
        transaction.amount,
      );

      this.items.splice(transactionIndex, 1);
    }
  }

  public async deleteManyPending(originTransaction: DebitExpenseTransaction) {
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

      this.items.splice(transactionIndex, 1);
    }
  }
}
