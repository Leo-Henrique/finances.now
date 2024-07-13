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

export type UpdateManyAccomplishedData = Pick<
  EarningTransactionDataUpdated,
  "categoryId" | "description"
>;

export type UpdateManyPendingData = Pick<
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
}
