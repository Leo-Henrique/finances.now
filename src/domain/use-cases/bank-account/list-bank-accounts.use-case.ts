import { Either, right } from "@/core/either";
import { paginationParamsSchema } from "@/core/schemas/pagination-params";
import { UseCase } from "@/core/use-case";
import { BankAccount } from "@/domain/entities/bank-account.entity";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { z } from "zod";

const listBankAccountsUseCaseSchema = z
  .object({
    userId: z.string().uuid(),
  })
  .merge(paginationParamsSchema);

export type ListBankAccountsUseCaseInput = z.infer<
  typeof listBankAccountsUseCaseSchema
>;

type ListBankAccountsUseCaseOutput = Either<
  null,
  { bankAccounts: BankAccount[]; total: number }
>;

type ListBankAccountsUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
};

export class ListBankAccountsUseCase extends UseCase<
  ListBankAccountsUseCaseInput,
  ListBankAccountsUseCaseOutput,
  ListBankAccountsUseCaseDeps
> {
  public constructor(deps: ListBankAccountsUseCaseDeps) {
    super({ inputSchema: listBankAccountsUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    items,
    page,
  }: ListBankAccountsUseCaseInput) {
    const bankAccounts = await this.deps.bankAccountRepository.findManyByUserId(
      userId,
      { items, page },
    );

    const total =
      await this.deps.bankAccountRepository.countManyByUserId(userId);

    return right({ bankAccounts, total });
  }
}
