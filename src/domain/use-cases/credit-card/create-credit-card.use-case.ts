import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UseCase } from "@/core/use-case";
import {
  CreditCard,
  CreditCardEntity,
} from "@/domain/entities/credit-card.entity";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import { z } from "zod";

const CreateCreditCardUseCaseSchema = CreditCardEntity.createSchema.extend({
  userId: UniqueEntityId.schema,
});

type CreateCreditCardUseCaseInput = z.infer<
  typeof CreateCreditCardUseCaseSchema
>;

type CreateCreditCardUseCaseOutput = Either<
  ResourceNotFoundError | ResourceAlreadyExistsError,
  { creditCard: CreditCard }
>;

type CreateCreditCardUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  creditCardRepository: CreditCardRepository;
};

export class CreateCreditCardUseCase extends UseCase<
  CreateCreditCardUseCaseInput,
  CreateCreditCardUseCaseOutput,
  CreateCreditCardUseCaseDeps
> {
  public constructor(deps: CreateCreditCardUseCaseDeps) {
    super({ inputSchema: CreateCreditCardUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    bankAccountId,
    name,
    ...restInput
  }: CreateCreditCardUseCaseInput) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
        userId,
        bankAccountId,
      );

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    const creditCardWithSameName =
      await this.deps.creditCardRepository.findUniqueFromUserByName(
        userId,
        name,
      );

    if (creditCardWithSameName)
      return left(new ResourceAlreadyExistsError("cartão de crédito"));

    const creditCard = CreditCardEntity.create({
      bankAccountId,
      name,
      ...restInput,
    });

    await this.deps.creditCardRepository.create(creditCard);

    return right({ creditCard });
  }
}
