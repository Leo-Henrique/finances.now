import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  BankAccount,
  BankAccountDataUpdated,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";

export class InMemoryBankAccountRepository
  extends InMemoryBaseRepository<
    BankAccountEntity,
    BankAccount,
    BankAccountDataUpdated
  >
  implements BankAccountRepository
{
  public async findUniqueById(bankAccountId: string) {
    const bankAccount = this.items.find(item => {
      return item.id.value === bankAccountId;
    });

    if (!bankAccount) return null;

    return bankAccount;
  }

  public async findUniqueFromUserById(userId: string, bankAccountId: string) {
    const bankAccount = this.items.find(item => {
      return item.userId.value === userId && item.id.value === bankAccountId;
    });

    if (!bankAccount) return null;

    return bankAccount;
  }

  public async findUniqueActivatedFromUserById(
    userId: string,
    bankAccountId: string,
  ) {
    const bankAccount = this.items.find(item => {
      return (
        item.userId.value === userId &&
        item.id.value === bankAccountId &&
        item.inactivatedAt === null
      );
    });

    if (!bankAccount) return null;

    return bankAccount;
  }

  public async findUniqueFromUserByInstitution(
    userId: string,
    institution: string,
  ) {
    const bankAccount = this.items.find(item => {
      return (
        item.userId.value === userId && item.institution.value === institution
      );
    });

    if (!bankAccount) return null;

    return bankAccount;
  }

  public async findUniqueFromUserBySlug(userId: string, slug: string) {
    const bankAccount = this.items.find(item => {
      return item.userId.value === userId && item.slug.value === slug;
    });

    if (!bankAccount) return null;

    return bankAccount;
  }

  public async findManyFromUser(
    userId: string,
    { items, page }: PaginationParams,
  ) {
    const bankAccounts = this.items
      .filter(item => item.userId.value === userId)
      .slice(items * (page - 1), items * page)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return bankAccounts;
  }

  public async countManyFromUser(userId: string) {
    const bankAccounts = this.items.filter(
      item => item.userId.value === userId,
    );

    return bankAccounts.length;
  }

  public async updateUniqueByIdIncreasingBalance(
    bankAccountId: string,
    amount: number,
  ): Promise<void> {
    const bankAccount = await this.findUniqueById(bankAccountId);

    if (!bankAccount) return;

    const updateBalance = bankAccount.update({
      balance: bankAccount.balance + amount,
    });

    await this.update(bankAccount, updateBalance);
  }

  public async updateUniqueByIdDecreasingBalance(
    bankAccountId: string,
    amount: number,
  ): Promise<void> {
    const bankAccount = await this.findUniqueById(bankAccountId);

    if (!bankAccount) return;

    const updateBalance = bankAccount.update({
      balance: bankAccount.balance - amount,
    });

    await this.update(bankAccount, updateBalance);
  }
}
