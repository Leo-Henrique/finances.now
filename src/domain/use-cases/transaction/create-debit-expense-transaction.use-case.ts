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
  taskSchedulingService: JobSchedulingService;
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
    transactedAt,
    amount,
    recurrencePeriod,
    recurrenceAmount,
    recurrenceLimit,
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
      transactedAt,
      amount,
      recurrencePeriod,
      recurrenceAmount,
      recurrenceLimit,
      ...restInput,
    });

    try {
      await this.deps.unitOfWork.begin();

      const decreasingUserBalance = async () => {
        await this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
          bankAccountId,
          amount,
        );
      };

      if (transactedAt <= new Date()) {
        await decreasingUserBalance();
      } else {
        await this.deps.taskSchedulingService.createUnique(
          decreasingUserBalance,
          transactedAt,
          { key: debitExpenseTransaction.id.value },
        );
      }

      if (recurrencePeriod) {
        await this.deps.taskSchedulingService.createRepeatableByPeriod(
          decreasingUserBalance,
          {
            key: debitExpenseTransaction.id.value,
            period: recurrencePeriod,
            fromDate: transactedAt,
            ...(recurrenceAmount && { amount: recurrenceAmount }),
            ...(recurrenceLimit && { limit: recurrenceLimit }),
          },
        );
      }

      await this.deps.debitExpenseTransactionRepository.create(
        debitExpenseTransaction,
      );

      await this.deps.unitOfWork.commit();
      debitExpenseTransaction;

      return right({ debitExpenseTransaction });
    } catch {
      await this.deps.unitOfWork.rollback();
      await this.deps.taskSchedulingService.deleteManyByKey(
        debitExpenseTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError());
    }
  }
}
