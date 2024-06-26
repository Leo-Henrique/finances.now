import { BaseRepository } from "@/core/repositories/base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  BankAccount,
  BankAccountDataUpdated,
  BankAccountEntity,
} from "../entities/bank-account.entity";

type CoreOperationsBankAccountRepository = BaseRepository<
  BankAccountEntity,
  BankAccount,
  BankAccountDataUpdated
>;

export interface BankAccountRepository
  extends CoreOperationsBankAccountRepository {
  findUniqueById(bankAccountId: string): Promise<BankAccount | null>;
  findUniqueFromUserById(
    userId: string,
    bankAccountId: string,
  ): Promise<BankAccount | null>;
  findUniqueActivatedFromUserById(
    userId: string,
    bankAccountId: string,
  ): Promise<BankAccount | null>;
  findUniqueFromUserByInstitution(
    userId: string,
    institution: string,
  ): Promise<BankAccount | null>;
  findUniqueFromUserBySlug(
    userId: string,
    slug: string,
  ): Promise<BankAccount | null>;
  findManyFromUser(
    userId: string,
    params: PaginationParams,
  ): Promise<BankAccount[]>;
  countManyFromUser(userId: string): Promise<number>;
  updateUniqueByIdIncreasingBalance(
    bankAccountId: string,
    amount: number,
  ): Promise<void>;
  updateUniqueByIdDecreasingBalance(
    bankAccountId: string,
    amount: number,
  ): Promise<void>;
}
