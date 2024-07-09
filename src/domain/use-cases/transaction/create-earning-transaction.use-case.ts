import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  EarningTransaction,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const createEarningTransactionUseCaseSchema =
  EarningTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateEarningTransactionUseCaseInput = z.infer<
  typeof createEarningTransactionUseCaseSchema
>;

export type CreateEarningTransactionUseCaseOutput = Either<
  ResourceNotFoundError | FailedToCreateTransactionError,
  { earningTransaction: EarningTransaction }
>;

type CreateEarningTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  earningTransactionRepository: EarningTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
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
    const { isAccomplished, amount, recurrencePeriod, recurrenceLimit } =
      earningTransaction;

    try {
      await this.deps.unitOfWork.begin();

      await this.deps.earningTransactionRepository.create(earningTransaction);

      if (isAccomplished) {
        await this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
          bankAccountId,
          amount,
        );
      }

      if (recurrencePeriod) {
        await this.deps.earningTransactionRepository.createManyOfRecurrence(
          earningTransaction,
        );

        if (!recurrenceLimit) {
          const middleTransactionOfCurrentRecurrence =
            await this.deps.earningTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
              earningTransaction.id.value,
            );

          if (!middleTransactionOfCurrentRecurrence) {
            throw new Error(
              "Failed to get middle transaction of current recurrence.",
            );
          }

          await this.deps.jobSchedulingService.createRepeatableByDynamicDate(
            async () => {
              const endTransactionOfCurrentRecurrence =
                await this.deps.earningTransactionRepository.findUniqueEndOfCurrentRecurrence(
                  earningTransaction.id.value,
                );

              if (!endTransactionOfCurrentRecurrence) return null;

              await this.deps.earningTransactionRepository.createManyOfRecurrence(
                earningTransaction,
                endTransactionOfCurrentRecurrence.transactedAt,
              );

              const middleTransactionOfCurrentRecurrence =
                await this.deps.earningTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
                  earningTransaction.id.value,
                );

              if (!middleTransactionOfCurrentRecurrence) return null;

              return middleTransactionOfCurrentRecurrence.transactedAt;
            },
            middleTransactionOfCurrentRecurrence.transactedAt,
            {
              key: earningTransaction.id.value,
            },
          );
        }
      }

      await this.deps.unitOfWork.commit();

      return right({ earningTransaction });
    } catch (error) {
      await this.deps.unitOfWork.rollback();
      await this.deps.jobSchedulingService.deleteManyByKey(
        earningTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError(error));
    }
  }
}
