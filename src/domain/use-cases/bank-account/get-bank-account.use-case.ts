import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { BankAccount } from "@/domain/entities/bank-account.entity";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { z } from "zod";

const getBankAccountUseCaseSchema = z.object({
  bankAccountId: z.string().uuid(),
  userId: z.string().uuid(),
});

export type GetBankAccountUseCaseInput = z.infer<
  typeof getBankAccountUseCaseSchema
>;

type GetBankAccountUseCaseOutput = Either<
  ResourceNotFoundError,
  { bankAccount: BankAccount }
>;

type GetBankAccountUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class GetBankAccountUseCase extends UseCase<
  GetBankAccountUseCaseInput,
  GetBankAccountUseCaseOutput,
  GetBankAccountUseCaseDeps
> {
  public constructor(deps: GetBankAccountUseCaseDeps) {
    super({ inputSchema: getBankAccountUseCaseSchema, deps });
  }

  protected async handle({
    bankAccountId,
    userId,
  }: GetBankAccountUseCaseInput) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueById(bankAccountId);

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    if (bankAccount.userId.value !== userId)
      return left(new UnauthorizedError());

    return right({ bankAccount });
  }
}
