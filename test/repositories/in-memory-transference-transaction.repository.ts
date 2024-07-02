import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  TransferenceTransaction,
  TransferenceTransactionDataUpdated,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";

export class InMemoryTransferenceTransactionRepository
  extends InMemoryBaseRepository<
    TransferenceTransactionEntity,
    TransferenceTransaction,
    TransferenceTransactionDataUpdated
  >
  implements TransferenceTransactionRepository {}
