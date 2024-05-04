import { Either, left, right } from "@/core/either";
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
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const CreateCreditCardUseCaseSchema = CreditCardEntity.createSchema;

type CreateCreditCardUseCaseInput = z.infer<
  typeof CreateCreditCardUseCaseSchema
>;

type CreateCreditCardUseCaseOutput = Either<
  ResourceNotFoundError | ResourceAlreadyExistsError,
  { creditCard: CreditCard }
>;

type CreateCreditCardUseCaseDeps = {
  userRepository: UserRepository;
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
    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

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
      userId,
      bankAccountId,
      name,
      ...restInput,
    });

    await this.deps.creditCardRepository.create(creditCard);

    return right({ creditCard });
  }
}
