import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  EarningTransaction,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { JobScheduling } from "@/domain/gateways/job-scheduling";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const createEarningTransactionUseCaseSchema =
  EarningTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateEarningTransactionUseCaseInput = z.infer<
  typeof createEarningTransactionUseCaseSchema
>;

export type CreateEarningTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  { earningTransaction: EarningTransaction }
>;

type CreateEarningTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  earningTransactionRepository: EarningTransactionRepository;
  jobScheduling: JobScheduling;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
};

export class CreateEarningTransactionUseCase extends UseCase<
  CreateEarningTransactionUseCaseInput,
  CreateEarningTransactionUseCaseOutput,
  CreateEarningTransactionUseCaseDeps
> {
  public constructor(deps: CreateEarningTransactionUseCaseDeps) {
    super({ inputSchema: createEarningTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    bankAccountId,
    categoryId,
    ...restInput
  }: CreateEarningTransactionUseCaseInput) {
    const bankAccount =
      await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
        userId,
        bankAccountId,
      );

    if (!bankAccount) return left(new ResourceNotFoundError("conta bancária"));

    const transactionCategory =
      await this.deps.transactionCategoryRepository.findUniqueFromUserById(
        userId,
        categoryId,
      );

    if (!transactionCategory)
      return left(new ResourceNotFoundError("categoria de transação"));

    const earningTransaction = EarningTransactionEntity.create({
      bankAccountId,
      categoryId,
      ...restInput,
    });
    const { isAccomplished, amount, recurrencePeriod } = earningTransaction;

    await this.deps.unitOfWork.transaction(async () => {
      await this.deps.earningTransactionRepository.create(earningTransaction);

      if (isAccomplished) {
        await this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
          bankAccountId,
          amount,
        );
      }

      if (recurrencePeriod) {
        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: earningTransaction,
          applyTransaction: false,
        });
      }
    });

    return right({ earningTransaction });
  }
}
