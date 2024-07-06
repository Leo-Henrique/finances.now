import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";

import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import { CreditExpenseTransactionRepository } from "@/domain/repositories/credit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const createCreditExpenseTransactionUseCaseSchema =
  CreditExpenseTransactionEntity.createSchema
    .extend({
      userId: UniqueEntityId.schema,
    })
    .omit({ paid: true });

type CreateCreditExpenseTransactionUseCaseInput = z.infer<
  typeof createCreditExpenseTransactionUseCaseSchema
>;

export type CreateCreditExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError | FailedToCreateTransactionError,
  { creditExpenseTransaction: CreditExpenseTransaction }
>;

type CreateCreditExpenseTransactionUseCaseDeps = {
  creditCardRepository: CreditCardRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  creditExpenseTransactionRepository: CreditExpenseTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class CreateCreditExpenseTransactionUseCase extends UseCase<
  CreateCreditExpenseTransactionUseCaseInput,
  CreateCreditExpenseTransactionUseCaseOutput,
  CreateCreditExpenseTransactionUseCaseDeps
> {
  public constructor(deps: CreateCreditExpenseTransactionUseCaseDeps) {
    super({ inputSchema: createCreditExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    creditCardId,
    categoryId,
    ...restInput
  }: CreateCreditExpenseTransactionUseCaseInput) {
    const creditCard =
      await this.deps.creditCardRepository.findUniqueActivatedFromUserById(
        userId,
        creditCardId,
      );

    if (!creditCard)
      return left(new ResourceNotFoundError("cartão de crédito"));

    const transactionCategory =
      await this.deps.transactionCategoryRepository.findUniqueFromUserById(
        userId,
        categoryId,
      );

    if (!transactionCategory)
      return left(new ResourceNotFoundError("categoria de transação"));

    const creditExpenseTransaction = CreditExpenseTransactionEntity.create({
      creditCardId,
      categoryId,
      ...restInput,
    });
    const { recurrencePeriod, recurrenceLimit } = creditExpenseTransaction;

    try {
      await this.deps.unitOfWork.begin();

      await this.deps.creditExpenseTransactionRepository.create(
        creditExpenseTransaction,
      );

      if (recurrencePeriod) {
        await this.deps.creditExpenseTransactionRepository.createManyOfRecurrence(
          creditExpenseTransaction,
        );

        if (!recurrenceLimit) {
          const middleTransactionOfCurrentRecurrence =
            await this.deps.creditExpenseTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
              creditExpenseTransaction.id.value,
            );

          if (!middleTransactionOfCurrentRecurrence) {
            throw new Error(
              "Failed to get middle transaction of current recurrence.",
            );
          }

          await this.deps.jobSchedulingService.createRepeatableByDynamicDate(
            async () => {
              const endTransactionOfCurrentRecurrence =
                await this.deps.creditExpenseTransactionRepository.findUniqueEndOfCurrentRecurrence(
                  creditExpenseTransaction.id.value,
                );

              if (!endTransactionOfCurrentRecurrence) return null;

              await this.deps.creditExpenseTransactionRepository.createManyOfRecurrence(
                creditExpenseTransaction,
                endTransactionOfCurrentRecurrence.transactedAt,
              );

              const middleTransactionOfCurrentRecurrence =
                await this.deps.creditExpenseTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
                  creditExpenseTransaction.id.value,
                );

              if (!middleTransactionOfCurrentRecurrence) return null;

              return middleTransactionOfCurrentRecurrence.transactedAt;
            },
            middleTransactionOfCurrentRecurrence.transactedAt,
            {
              key: creditExpenseTransaction.id.value,
            },
          );
        }
      }

      await this.deps.unitOfWork.commit();

      return right({ creditExpenseTransaction });
    } catch (error) {
      await this.deps.unitOfWork.rollback();
      await this.deps.jobSchedulingService.deleteManyByKey(
        creditExpenseTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError(error));
    }
  }
}
