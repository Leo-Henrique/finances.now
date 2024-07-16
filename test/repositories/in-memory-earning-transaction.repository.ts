import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import {
  EarningTransactionRepository,
  UpdateManyAccomplishedEarningTransactionsData,
  UpdateManyPendingEarningTransactionsData,
} from "@/domain/repositories/earning-transaction.repository";

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

    let index =
      recurringTransactions.length -
      (earningTransactionsNumberPerTimeInRecurrence / 2 + 1);

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

  public async findUniqueOriginTransactionById(transactionId: string) {
    const earningTransaction = this.items.find(item => {
      return item.id.value === transactionId;
    });

    if (!earningTransaction) return null;

    const originTransaction = this.items.find(item => {
      return item.id.value === earningTransaction.originId?.value;
    });

    if (originTransaction) return originTransaction;

    if (earningTransaction.recurrencePeriod) return earningTransaction;

    return null;
  }

  public async updateManyAccomplished(
    earningTransaction: EarningTransaction,
    data: UpdateManyAccomplishedEarningTransactionsData,
  ) {
    const originTransactionId =
      earningTransaction.originId?.value ?? earningTransaction.id?.value;
    const transactions = this.items.filter(item => {
      const matchIds =
        item.id.value === originTransactionId ||
        item.originId?.value === originTransactionId;

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
    earningTransaction: EarningTransaction,
    data: UpdateManyPendingEarningTransactionsData,
  ) {
    const originTransactionId =
      earningTransaction.originId?.value ?? earningTransaction.id?.value;
    const transactions = this.items.filter(item => {
      const matchIds =
        item.id.value === originTransactionId ||
        item.originId?.value === originTransactionId;

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
