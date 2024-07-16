import { BaseRepository } from "@/core/repositories/base-repository";
import {
  EarningTransaction,
  EarningTransactionDataUpdated,
  EarningTransactionEntity,
} from "../entities/earning-transaction.entity";
import { TransactionRepository } from "./transaction.repository";

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

type EarningTransactionRecurrenceRepository = TransactionRepository<
  EarningTransaction,
  UpdateManyAccomplishedEarningTransactionsData,
  UpdateManyPendingEarningTransactionsData
>;

export interface EarningTransactionRepository
  extends CoreOperationsEarningTransactionRepository,
    EarningTransactionRecurrenceRepository {}
