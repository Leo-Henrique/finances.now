import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import {
  BankAccount,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import {
  ResourceAlreadyExistsError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const createBankAccountUseCaseSchema = BankAccountEntity.createSchema;

type CreateBankAccountUseCaseInput = z.infer<
  typeof createBankAccountUseCaseSchema
>;

type CreateBankAccountUseCaseOutput = Either<
  ResourceNotFoundError | ResourceAlreadyExistsError,
  { bankAccount: BankAccount }
>;

type CreateBankAccountUseCaseDeps = {
  userRepository: UserRepository;
  bankAccountRepository: BankAccountRepository;
};

export class CreateBankAccountUseCase extends UseCase<
  CreateBankAccountUseCaseInput,
  CreateBankAccountUseCaseOutput,
  CreateBankAccountUseCaseDeps
> {
  public constructor(deps: CreateBankAccountUseCaseDeps) {
    super({ inputSchema: createBankAccountUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    institution,
    ...restInput
  }: CreateBankAccountUseCaseInput) {
    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    const bankAccountWithSameInstitution =
      await this.deps.bankAccountRepository.findUniqueFromUserByInstitution(
        userId,
        institution,
      );

    if (bankAccountWithSameInstitution)
      return left(new ResourceAlreadyExistsError("conta bancária"));

    const bankAccount = BankAccountEntity.create({
      userId,
      institution,
      ...restInput,
    });

    await this.deps.bankAccountRepository.create(bankAccount);

    return right({ bankAccount });
  }
}
