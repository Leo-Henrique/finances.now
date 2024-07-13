import { Transaction } from "../entities/transaction.entity";

export interface TransactionRecurrenceRepository<
  TransactionRecurrence extends Transaction,
> {
  createManyOfRecurrence(
    originTransaction: TransactionRecurrence,
    lastTransactedDate?: Date,
  ): Promise<void>;
  findUniqueMiddleOfCurrentRecurrence(
    originId: string,
  ): Promise<TransactionRecurrence | null>;
  findUniqueEndOfCurrentRecurrence(
    originId: string,
  ): Promise<TransactionRecurrence | null>;
}
