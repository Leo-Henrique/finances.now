import {
  Transaction as AbstractTransaction,
  TransactionDataUpdated,
} from "../entities/transaction.entity";

export interface TransactionRepository<
  Transaction extends AbstractTransaction = AbstractTransaction,
  UpdateManyAccomplishedData extends
    TransactionDataUpdated = TransactionDataUpdated,
  UpdateManyPendingData extends TransactionDataUpdated = TransactionDataUpdated,
> {
  createManyOfRecurrence(
    originTransaction: Transaction,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<Transaction | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<Transaction | null>;
  findUniqueOriginTransactionById(
    transactionId: string,
  ): Promise<Transaction | null>;
  findUniqueFromUserById(
    userId: string,
    transactionId: string,
  ): Promise<Transaction | null>;
  updateManyAccomplished(
    originTransaction: Transaction,
    data: UpdateManyAccomplishedData,
  ): Promise<void>;
  updateManyPending(
    originTransaction: Transaction,
    data: UpdateManyPendingData,
  ): Promise<void>;
  deleteManyPending(originTransaction: Transaction): Promise<void>;
}
