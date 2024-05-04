import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  CreditCard,
  CreditCardDataUpdated,
  CreditCardEntity,
} from "@/domain/entities/credit-card.entity";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";

export class InMemoryCreditCardRepository
  extends InMemoryBaseRepository<
    CreditCardEntity,
    CreditCard,
    CreditCardDataUpdated
  >
  implements CreditCardRepository
{
  public async findUniqueFromUserById(userId: string, creditCardId: string) {
    const creditCard = this.items.find(item => {
      return item.userId.value === userId && item.id.value === creditCardId;
    });

    if (!creditCard) return null;

    return creditCard;
  }

  public async findUniqueFromUserByName(userId: string, name: string) {
    const creditCard = this.items.find(item => {
      return item.userId.value === userId && item.name.value === name;
    });

    if (!creditCard) return null;

    return creditCard;
  }

  public async findUniqueFromUserBySlug(userId: string, slug: string) {
    const creditCard = this.items.find(item => {
      return item.userId.value === userId && item.slug.value === slug;
    });

    if (!creditCard) return null;

    return creditCard;
  }

  public async findManyFromUser(
    userId: string,
    { items, page }: PaginationParams,
  ) {
    const creditCards = this.items
      .filter(item => item.userId.value === userId)
      .slice(items * (page - 1), items * page)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return creditCards;
  }

  public async countManyFromUser(userId: string) {
    const creditCards = this.items.filter(item => item.userId.value === userId);

    return creditCards.length;
  }
}
