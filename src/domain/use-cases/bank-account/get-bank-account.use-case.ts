import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UseCase } from "@/core/use-case";
import { BankAccount } from "@/domain/entities/bank-account.entity";
import { Slug } from "@/domain/entities/value-objects/slug";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { z } from "zod";

const getBankAccountUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  bankAccountSlug: Slug.schema,
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
    userId,
    bankAccountSlug,
  }: GetBankAccountUseCaseInput) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueFromUserBySlug(
        userId,
        bankAccountSlug,
      );

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    return right({ bankAccount });
  }
}
