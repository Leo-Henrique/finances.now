import { BaseRepository } from "@/core/repositories/base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "../entities/transference-transaction.entity";
import { TransactionRepository } from "./transaction.repository";

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

type TransferenceTransactionRecurrenceRepository = TransactionRepository<
  TransferenceTransaction,
  UpdateManyAccomplishedTransferenceTransactionsData,
  UpdateManyPendingTransferenceTransactionsData
>;

export interface TransferenceTransactionRepository
  extends CoreOperationsTransferenceTransactionRepository,
    TransferenceTransactionRecurrenceRepository {
  deleteManyAccomplished(
    originTransaction: TransferenceTransaction,
  ): Promise<void>;
}
