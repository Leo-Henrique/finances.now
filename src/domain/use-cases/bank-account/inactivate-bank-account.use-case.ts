import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UseCase } from "@/core/use-case";
import { BankAccount } from "@/domain/entities/bank-account.entity";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { z } from "zod";

const inactivateBankAccountUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  bankAccountId: UniqueEntityId.schema,
});

type InactivateBankAccountUseCaseInput = z.infer<
  typeof inactivateBankAccountUseCaseSchema
>;

type InactivateBankAccountUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError | UnauthorizedError,
  { bankAccount: BankAccount }
>;

type InactivateBankAccountUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class InactivateBankAccountUseCase extends UseCase<
  InactivateBankAccountUseCaseInput,
  InactivateBankAccountUseCaseOutput,
  InactivateBankAccountUseCaseDeps
> {
  public constructor(deps: InactivateBankAccountUseCaseDeps) {
    super({ inputSchema: inactivateBankAccountUseCaseSchema, deps });
  }

  protected async handle({
    bankAccountId,
    userId,
  }: InactivateBankAccountUseCaseInput) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        bankAccountId,
      );

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    const updatedFields = bankAccount.update({
      inactivatedAt: bankAccount.inactivatedAt ? null : new Date(),
    });

    await this.deps.bankAccountRepository.update(bankAccount, updatedFields);

    return right({ bankAccount });
  }
}
