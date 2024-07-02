import { BaseRepository } from "@/core/repositories/base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "../entities/earning-transaction.entity";

type CoreOperationsEarningTransactionRepository = BaseRepository<
  EarningTransactionEntity,
  EarningTransaction,
  EarningTransactionDataUpdated
>;

export interface EarningTransactionRepository
  extends CoreOperationsEarningTransactionRepository {
  createManyOfRecurrence(
    originTransaction: EarningTransaction,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<EarningTransaction | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<EarningTransaction | null>;
}
