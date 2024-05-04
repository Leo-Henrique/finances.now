import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
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

const updateCreditCardUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  creditCardId: UniqueEntityId.schema,
  data: CreditCardEntity.updateSchema.pick({
    bankAccountId: true,
    name: true,
    description: true,
    limit: true,
    invoiceClosingDay: true,
    invoiceDueDay: true,
    mainCard: true,
  }),
});

type UpdateCreditCardUseCaseInput = z.infer<
  typeof updateCreditCardUseCaseSchema
>;

type UpdateCreditCardUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError | ResourceAlreadyExistsError,
  { creditCard: CreditCard }
>;

type UpdateCreditCardUseCaseDeps = {
  creditCardRepository: CreditCardRepository;
  bankAccountRepository: BankAccountRepository;
};

export class UpdateCreditCardUseCase extends UseCase<
  UpdateCreditCardUseCaseInput,
  UpdateCreditCardUseCaseOutput,
  UpdateCreditCardUseCaseDeps
> {
  public constructor(deps: UpdateCreditCardUseCaseDeps) {
    super({ inputSchema: updateCreditCardUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    creditCardId,
    data,
  }: UpdateCreditCardUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const creditCard =
      await this.deps.creditCardRepository.findUniqueFromUserById(
        userId,
        creditCardId,
      );

    if (!creditCard)
      return left(new ResourceNotFoundError("cartão de crédito"));

    if (data.bankAccountId) {
      const bankAccount =
        await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
          userId,
          data.bankAccountId,
        );

      if (!bankAccount)
        return left(new ResourceNotFoundError("conta bancária"));
    }

    if (data.name) {
      const creditCardWithSameName =
        await this.deps.creditCardRepository.findUniqueFromUserByName(
          userId,
          data.name,
        );

      if (
        creditCardWithSameName &&
        creditCardWithSameName.id.value !== creditCardId
      )
        return left(new ResourceAlreadyExistsError("cartão de crédito"));
    }

    const updatedFields = creditCard.update(data);

    await this.deps.creditCardRepository.update(creditCard, updatedFields);

    return right({ creditCard });
  }
}
