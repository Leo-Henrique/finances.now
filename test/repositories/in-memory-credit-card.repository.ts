import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  CreditCard,
  CreditCardDataUpdated,
  CreditCardEntity,
} from "@/domain/entities/credit-card.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";

type InMemoryCreditCardRepositoryDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class InMemoryCreditCardRepository
  extends InMemoryBaseRepository<
    CreditCardEntity,
    CreditCard,
    CreditCardDataUpdated
  >
  implements CreditCardRepository
{
  public constructor(private deps: InMemoryCreditCardRepositoryDeps) {
    super();
  }

  private async userIsOwnerFromBankAccount(
    bankAccountId: string,
    userId: string,
  ) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueById(bankAccountId);

    if (!bankAccount) return false;

    if (userId !== bankAccount.userId.value) return false;

    return true;
  }

  public async findUniqueFromUserById(userId: string, creditCardId: string) {
    const creditCard = this.items.find(item => {
      return item.id.value === creditCardId;
    });

    if (!creditCard) return null;

    const userIsOwner = await this.userIsOwnerFromBankAccount(
      creditCard.bankAccountId.value,
      userId,
    );

    if (!userIsOwner) return null;

    return creditCard;
  }

  public async findUniqueFromUserByName(userId: string, name: string) {
    const creditCard = this.items.find(item => {
      return item.name.value === name;
    });

    if (!creditCard) return null;

    const userIsOwner = await this.userIsOwnerFromBankAccount(
      creditCard.bankAccountId.value,
      userId,
    );

    if (!userIsOwner) return null;

    return creditCard;
  }

  public async findUniqueFromUserBySlug(userId: string, slug: string) {
    const creditCard = this.items.find(item => {
      return item.slug.value === slug;
    });

    if (!creditCard) return null;

    const userIsOwner = await this.userIsOwnerFromBankAccount(
      creditCard.bankAccountId.value,
      userId,
    );

    if (!userIsOwner) return null;

    return creditCard;
  }

  public async findManyFromUser(
    userId: string,
    { items, page }: PaginationParams,
  ) {
    const creditCards = this.items
      .filter(async item => {
        const userIsOwner = await this.userIsOwnerFromBankAccount(
          item.bankAccountId.value,
          userId,
        );

        return userIsOwner;
      })
      .slice(items * (page - 1), items * page)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return creditCards;
  }

  public async countManyFromUser(userId: string) {
    const creditCards = this.items.filter(async item => {
      const userIsOwner = await this.userIsOwnerFromBankAccount(
        item.bankAccountId.value,
        userId,
      );

      return userIsOwner;
    });

    return creditCards.length;
  }
}
