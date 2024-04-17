import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  BankAccount,
  BankAccountDataUpdated,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import { User } from "@/domain/entities/user.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";

export class InMemoryBankAccountRepository
  extends InMemoryBaseRepository<
    BankAccountEntity,
    BankAccount,
    BankAccountDataUpdated
  >
  implements BankAccountRepository
{
  async findManyByUserId(
    userId: User["id"]["value"],
    { items, page }: PaginationParams,
  ) {
    const bankAccounts = this.items
      .filter(item => item.userId.value === userId)
      .slice(items * (page - 1), items * page)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return bankAccounts;
  }

  async countManyByUserId(userId: User["id"]["value"]) {
    const bankAccounts = this.items.filter(
      item => item.userId.value === userId,
    );

    return bankAccounts.length;
  }
}
