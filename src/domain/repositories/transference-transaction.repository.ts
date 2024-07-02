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
  extends CoreOperationsTransferenceTransactionRepository {}
