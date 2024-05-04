import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UseCase } from "@/core/use-case";
import { CreditCard } from "@/domain/entities/credit-card.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import { z } from "zod";

const inactivateCreditCardUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  creditCardId: UniqueEntityId.schema,
});

type InactivateCreditCardUseCaseInput = z.infer<
  typeof inactivateCreditCardUseCaseSchema
>;

type InactivateCreditCardUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
  { creditCard: CreditCard }
>;

type InactivateCreditCardUseCaseDeps = {
  creditCardRepository: CreditCardRepository;
};

export class InactivateCreditCardUseCase extends UseCase<
  InactivateCreditCardUseCaseInput,
  InactivateCreditCardUseCaseOutput,
  InactivateCreditCardUseCaseDeps
> {
  public constructor(deps: InactivateCreditCardUseCaseDeps) {
    super({ inputSchema: inactivateCreditCardUseCaseSchema, deps });
  }

  protected async handle({
    creditCardId,
    userId,
  }: InactivateCreditCardUseCaseInput) {
    const creditCard =
      await this.deps.creditCardRepository.findUniqueFromUserById(
        userId,
        creditCardId,
      );

    if (!creditCard)
      return left(new ResourceNotFoundError("cartão de crédito"));

    const updatedFields = creditCard.update({
      inactivatedAt: creditCard.inactivatedAt ? null : new Date(),
    });

    await this.deps.creditCardRepository.update(creditCard, updatedFields);

    return right({ creditCard });
  }
}
