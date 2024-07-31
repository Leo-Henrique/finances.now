import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";

import { ResourceNotFoundError } from "@/domain/errors";
import { JobScheduling } from "@/domain/gateways/job-scheduling";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import { CreditExpenseTransactionRepository } from "@/domain/repositories/credit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const createCreditExpenseTransactionUseCaseSchema =
  CreditExpenseTransactionEntity.createSchema
    .extend({
      userId: UniqueEntityId.schema,
    })
    .omit({ isAccomplished: true });

type CreateCreditExpenseTransactionUseCaseInput = z.infer<
  typeof createCreditExpenseTransactionUseCaseSchema
>;

export type CreateCreditExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  { creditExpenseTransaction: CreditExpenseTransaction }
>;

type CreateCreditExpenseTransactionUseCaseDeps = {
  creditCardRepository: CreditCardRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  creditExpenseTransactionRepository: CreditExpenseTransactionRepository;
  jobScheduling: JobScheduling;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
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
    const { recurrencePeriod } = creditExpenseTransaction;

    await this.deps.unitOfWork.transaction(async () => {
      await this.deps.creditExpenseTransactionRepository.create(
        creditExpenseTransaction,
      );

      if (recurrencePeriod) {
        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: creditExpenseTransaction,
          applyTransaction: false,
        });
      }
    });

    return right({ creditExpenseTransaction });
  }
}
