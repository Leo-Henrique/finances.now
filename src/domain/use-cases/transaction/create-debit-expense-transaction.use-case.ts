import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { DebitExpenseTransactionRepository } from "@/domain/repositories/debit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const createDebitExpenseTransactionUseCaseSchema =
  DebitExpenseTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateDebitExpenseTransactionUseCaseInput = z.infer<
  typeof createDebitExpenseTransactionUseCaseSchema
>;

export type CreateDebitExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError | FailedToCreateTransactionError,
  { debitExpenseTransaction: DebitExpenseTransaction }
>;

type CreateDebitExpenseTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  debitExpenseTransactionRepository: DebitExpenseTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class CreateDebitExpenseTransactionUseCase extends UseCase<
  CreateDebitExpenseTransactionUseCaseInput,
  CreateDebitExpenseTransactionUseCaseOutput,
  CreateDebitExpenseTransactionUseCaseDeps
> {
  public constructor(deps: CreateDebitExpenseTransactionUseCaseDeps) {
    super({ inputSchema: createDebitExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    bankAccountId,
    categoryId,
    ...restInput
  }: CreateDebitExpenseTransactionUseCaseInput) {
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

    const debitExpenseTransaction = DebitExpenseTransactionEntity.create({
      bankAccountId,
      categoryId,
      ...restInput,
    });
    const { paid, amount, recurrencePeriod, recurrenceLimit } =
      debitExpenseTransaction;

    try {
      await this.deps.unitOfWork.begin();

      await this.deps.debitExpenseTransactionRepository.create(
        debitExpenseTransaction,
      );

      if (paid) {
        await this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
          bankAccountId,
          amount,
        );
      }

      if (recurrencePeriod) {
        await this.deps.debitExpenseTransactionRepository.createManyOfRecurrence(
          debitExpenseTransaction,
        );

        if (!recurrenceLimit) {
          const middleTransactionOfCurrentRecurrence =
            await this.deps.debitExpenseTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
              debitExpenseTransaction.id.value,
            );

          if (!middleTransactionOfCurrentRecurrence) {
            throw new Error(
              "Failed to get middle transaction of current recurrence.",
            );
          }

          await this.deps.jobSchedulingService.createRepeatableByDynamicDate(
            async () => {
              const endTransactionOfCurrentRecurrence =
                await this.deps.debitExpenseTransactionRepository.findUniqueEndOfCurrentRecurrence(
                  debitExpenseTransaction.id.value,
                );

              if (!endTransactionOfCurrentRecurrence) return null;

              await this.deps.debitExpenseTransactionRepository.createManyOfRecurrence(
                debitExpenseTransaction,
                endTransactionOfCurrentRecurrence.transactedAt,
              );

              const middleTransactionOfCurrentRecurrence =
                await this.deps.debitExpenseTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
                  debitExpenseTransaction.id.value,
                );

              if (!middleTransactionOfCurrentRecurrence) return null;

              return middleTransactionOfCurrentRecurrence.transactedAt;
            },
            middleTransactionOfCurrentRecurrence.transactedAt,
            {
              key: debitExpenseTransaction.id.value,
            },
          );
        }
      }

      await this.deps.unitOfWork.commit();

      return right({ debitExpenseTransaction });
    } catch (error) {
      await this.deps.unitOfWork.rollback();
      await this.deps.jobSchedulingService.deleteManyByKey(
        debitExpenseTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError(error));
    }
  }
}
