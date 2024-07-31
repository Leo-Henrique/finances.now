import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { JobScheduling } from "@/domain/gateways/job-scheduling";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { DebitExpenseTransactionRepository } from "@/domain/repositories/debit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const createDebitExpenseTransactionUseCaseSchema =
  DebitExpenseTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateDebitExpenseTransactionUseCaseInput = z.infer<
  typeof createDebitExpenseTransactionUseCaseSchema
>;

export type CreateDebitExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  { debitExpenseTransaction: DebitExpenseTransaction }
>;

type CreateDebitExpenseTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  debitExpenseTransactionRepository: DebitExpenseTransactionRepository;
  jobScheduling: JobScheduling;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
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
    const { isAccomplished, amount, recurrencePeriod } =
      debitExpenseTransaction;

    await this.deps.unitOfWork.transaction(async () => {
      await this.deps.debitExpenseTransactionRepository.create(
        debitExpenseTransaction,
      );

      if (isAccomplished) {
        await this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
          bankAccountId,
          amount,
        );
      }

      if (recurrencePeriod) {
        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: debitExpenseTransaction,
          applyTransaction: false,
        });
      }
    });

    return right({ debitExpenseTransaction });
  }
}
