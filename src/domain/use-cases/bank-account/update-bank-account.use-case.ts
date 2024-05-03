import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UseCase } from "@/core/use-case";
import {
  BankAccount,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
  UnauthorizedError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { z } from "zod";

const updateBankAccountUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  bankAccountId: UniqueEntityId.schema,
  data: BankAccountEntity.updateSchema.pick({
    institution: true,
    description: true,
    mainAccount: true,
  }),
});

type UpdateBankAccountUseCaseInput = z.infer<
  typeof updateBankAccountUseCaseSchema
>;

type UpdateBankAccountUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError | UnauthorizedError,
  { bankAccount: BankAccount }
>;

type UpdateBankAccountUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class UpdateBankAccountUseCase extends UseCase<
  UpdateBankAccountUseCaseInput,
  UpdateBankAccountUseCaseOutput,
  UpdateBankAccountUseCaseDeps
> {
  public constructor(deps: UpdateBankAccountUseCaseDeps) {
    super({ inputSchema: updateBankAccountUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    bankAccountId,
    data,
  }: UpdateBankAccountUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserById(
        userId,
        bankAccountId,
      );

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    if (data.institution) {
      const bankAccountWithSameInstitution =
        await this.deps.bankAccountRepository.findUniqueFromUserByInstitution(
          userId,
          data.institution,
        );

      if (bankAccountWithSameInstitution)
        return left(new ResourceAlreadyExistsError("conta bancária"));
    }

    const updatedFields = bankAccount.update(data);

    await this.deps.bankAccountRepository.update(bankAccount, updatedFields);

    return right({ bankAccount });
  }
}
