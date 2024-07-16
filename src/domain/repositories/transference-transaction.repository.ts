import { BaseRepository } from "@/core/repositories/base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "../entities/transference-transaction.entity";
import { TransactionRecurrenceRepository } from "./transaction-recurrence.repository";

type CoreOperationsTransferenceTransactionRepository = BaseRepository<
  TransferenceTransactionEntity,
  TransferenceTransaction,
  TransferenceTransactionDataUpdated
>;

export type UpdateManyAccomplishedTransferenceTransactionsData = Pick<
  TransferenceTransactionDataUpdated,
  "description"
>;

export type UpdateManyPendingTransferenceTransactionsData = Pick<
  TransferenceTransactionDataUpdated,
  "description" | "amount"
>;

export interface TransferenceTransactionRepository
  extends CoreOperationsTransferenceTransactionRepository,
    TransactionRecurrenceRepository<TransferenceTransaction> {
  findUniqueFromUserById(
    userId: string,
    transferenceTransactionId: string,
  ): Promise<TransferenceTransaction | null>;
  updateManyAccomplished(
    originTransaction: TransferenceTransaction,
    data: UpdateManyAccomplishedTransferenceTransactionsData,
  ): Promise<void>;
  updateManyPending(
    originTransaction: TransferenceTransaction,
    data: UpdateManyPendingTransferenceTransactionsData,
  ): Promise<void>;
}
