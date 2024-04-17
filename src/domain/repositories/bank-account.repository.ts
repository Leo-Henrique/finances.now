import { BaseRepository } from "@/core/repositories/base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  BankAccount,
  BankAccountDataUpdated,
  BankAccountEntity,
} from "../entities/bank-account.entity";
import { User } from "../entities/user.entity";

type CoreOperationsBankAccountRepository = BaseRepository<
  BankAccountEntity,
  BankAccount,
  BankAccountDataUpdated
>;

export interface BankAccountRepository
  extends CoreOperationsBankAccountRepository {
  findManyByUserId(
    userId: User["id"]["value"],
    params: PaginationParams,
  ): Promise<BankAccount[]>;
  countManyByUserId(userId: User["id"]["value"]): Promise<number>;
}
