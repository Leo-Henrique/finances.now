import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionDataUpdated,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import {
  CreditExpenseTransactionRepository,
  UpdateManyAccomplishedCreditExpenseTransactionsData,
  UpdateManyPendingCreditExpenseTransactionsData,
} from "@/domain/repositories/credit-expense-transaction.repository";

export const IN_MEMORY_COUNT_BATCH_CREDIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE = 100;

type InMemoryCreditExpenseTransactionRepositoryDeps = {
  creditCardRepository: CreditCardRepository;
};

export class InMemoryCreditExpenseTransactionRepository
  extends InMemoryBaseRepository<
    CreditExpenseTransactionEntity,
    CreditExpenseTransaction,
    CreditExpenseTransactionDataUpdated
  >
  implements CreditExpenseTransactionRepository
{
  public constructor(
    private deps: InMemoryCreditExpenseTransactionRepositoryDeps,
  ) {
    super();
  }

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
      (recurrenceLimit ??
        IN_MEMORY_COUNT_BATCH_CREDIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE);
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

    let index =
      recurringTransactions.length -
      (IN_MEMORY_COUNT_BATCH_CREDIT_EXPENSE_TRANSACTIONS_IN_RECURRENCE / 2 + 1);

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
    creditExpenseTransactionId: string,
  ) {
    const creditExpenseTransaction = this.items.find(item => {
      return item.id.value === creditExpenseTransactionId;
    });

    if (!creditExpenseTransaction) return null;

    const creditCard =
      await this.deps.creditCardRepository.findUniqueFromUserById(
        userId,
        creditExpenseTransaction.creditCardId.value,
      );

    if (!creditCard) return null;

    return creditExpenseTransaction;
  }

  public async findUniqueOriginTransactionById(transactionId: string) {
    const creditExpenseTransaction = this.items.find(item => {
      return item.id.value === transactionId;
    });

    if (!creditExpenseTransaction) return null;

    const originTransaction = this.items.find(item => {
      return item.id.value === creditExpenseTransaction.originId?.value;
    });

    if (originTransaction) return originTransaction;

    if (creditExpenseTransaction.recurrencePeriod)
      return creditExpenseTransaction;

    return null;
  }

  public async updateManyAccomplished(
    originTransaction: CreditExpenseTransaction,
    data: UpdateManyAccomplishedCreditExpenseTransactionsData,
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
    originTransaction: CreditExpenseTransaction,
    data: UpdateManyPendingCreditExpenseTransactionsData,
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

  public async deleteManyPending(originTransaction: CreditExpenseTransaction) {
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
