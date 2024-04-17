import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import {
  BankAccount,
  BankAccountEntity,
} from "@/domain/entities/bank-account.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const createBankAccountUseCaseSchema = BankAccountEntity.createSchema;

type CreateBankAccountUseCaseInput = z.infer<
  typeof createBankAccountUseCaseSchema
>;

type CreateBankAccountUseCaseOutput = Either<
  ResourceNotFoundError,
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
    ...restInput
  }: CreateBankAccountUseCaseInput) {
    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    const bankAccount = BankAccountEntity.create({ userId, ...restInput });

    await this.deps.bankAccountRepository.create(bankAccount);

    return right({ bankAccount });
  }
}
