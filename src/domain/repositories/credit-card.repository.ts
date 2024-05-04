import { BaseRepository } from "@/core/repositories/base-repository";
import { PaginationParams } from "@/core/schemas/pagination-params";
import {
  CreditCard,
  CreditCardDataUpdated,
  CreditCardEntity,
} from "../entities/credit-card.entity";

type CoreOperationsCreditCardRepository = BaseRepository<
  CreditCardEntity,
  CreditCard,
  CreditCardDataUpdated
>;

export interface CreditCardRepository
  extends CoreOperationsCreditCardRepository {
  findUniqueFromUserById(
    userId: string,
    creditCardId: string,
  ): Promise<CreditCard | null>;
  findUniqueFromUserByName(
    userId: string,
    name: string,
  ): Promise<CreditCard | null>;
  findUniqueFromUserBySlug(
    userId: string,
    slug: string,
  ): Promise<CreditCard | null>;
  findManyFromUser(
    userId: string,
    params: PaginationParams,
  ): Promise<CreditCard[]>;
  countManyFromUser(userId: string): Promise<number>;
}
