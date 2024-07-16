import { BaseRepository } from "@/core/repositories/base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "../entities/earning-transaction.entity";
import { TransactionRecurrenceRepository } from "./transaction-recurrence.repository";

type CoreOperationsEarningTransactionRepository = BaseRepository<
  EarningTransactionEntity,
  EarningTransaction,
  EarningTransactionDataUpdated
>;

export type UpdateManyAccomplishedEarningTransactionsData = Pick<
  EarningTransactionDataUpdated,
  "categoryId" | "description"
>;

export type UpdateManyPendingEarningTransactionsData = Pick<
  EarningTransactionDataUpdated,
  "categoryId" | "description" | "amount"
>;

export interface EarningTransactionRepository
  extends CoreOperationsEarningTransactionRepository,
    TransactionRecurrenceRepository<EarningTransaction> {
  findUniqueFromUserById(
    userId: string,
    earningTransactionId: string,
  ): Promise<EarningTransaction | null>;
  updateManyAccomplished(
    originTransaction: EarningTransaction,
    data: UpdateManyAccomplishedEarningTransactionsData,
  ): Promise<void>;
  updateManyPending(
    originTransaction: EarningTransaction,
    data: UpdateManyPendingEarningTransactionsData,
  ): Promise<void>;
}
