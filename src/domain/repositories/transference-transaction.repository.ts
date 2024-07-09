import { BaseRepository } from "@/core/repositories/base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "../entities/transference-transaction.entity";

type CoreOperationsTransferenceTransactionRepository = BaseRepository<
  TransferenceTransactionEntity,
  TransferenceTransaction,
  TransferenceTransactionDataUpdated
>;

export interface TransferenceTransactionRepository
  extends CoreOperationsTransferenceTransactionRepository {
  createManyOfRecurrence(
    originTransaction: TransferenceTransaction,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<TransferenceTransaction | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<TransferenceTransaction | null>;
  findUniqueFromUserById(
    userId: string,
    transferenceTransactionId: string,
  ): Promise<TransferenceTransaction | null>;
}
