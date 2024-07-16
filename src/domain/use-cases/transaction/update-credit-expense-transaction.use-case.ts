import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  CreditExpenseTransaction,
  CreditExpenseTransactionEntity,
} from "@/domain/entities/credit-expense-transaction.entity";
import { ForbiddenActionError, ResourceNotFoundError } from "@/domain/errors";
import { CreditCardRepository } from "@/domain/repositories/credit-card.repository";
import { CreditExpenseTransactionRepository } from "@/domain/repositories/credit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const updateCreditExpenseTransactionUseCaseSchema = z
  .object({
    userId: UniqueEntityId.schema,
    creditExpenseTransactionId: UniqueEntityId.schema,
    recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
    data: CreditExpenseTransactionEntity.updateSchema.pick({
      creditCardId: true,
      categoryId: true,
      amount: true,
      transactedAt: true,
      description: true,
    }),
  })
  .refine(output => {
    if (output.recurrence && output.data.creditCardId) return false;

    if (output.recurrence && output.data.transactedAt) return false;

    if (
      (output.recurrence === "accomplished" || output.recurrence === "all") &&
      output.data.amount
    )
      return false;

    return true;
  });

export type UpdateCreditExpenseTransactionUseCaseInput = z.infer<
  typeof updateCreditExpenseTransactionUseCaseSchema
>;

type UpdateCreditExpenseTransactionUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
  {
    creditExpenseTransaction: CreditExpenseTransaction;
  }
>;

type UpdateCreditExpenseTransactionUseCaseDeps = {
  creditCardRepository: CreditCardRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  creditExpenseTransactionRepository: CreditExpenseTransactionRepository;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
};

export class UpdateCreditExpenseTransactionUseCase extends UseCase<
  UpdateCreditExpenseTransactionUseCaseInput,
  UpdateCreditExpenseTransactionUseCaseOutput,
  UpdateCreditExpenseTransactionUseCaseDeps
> {
  public constructor(deps: UpdateCreditExpenseTransactionUseCaseDeps) {
    super({ inputSchema: updateCreditExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    creditExpenseTransactionId,
    recurrence,
    data,
  }: UpdateCreditExpenseTransactionUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const creditExpenseTransaction =
      await this.deps.creditExpenseTransactionRepository.findUniqueFromUserById(
        userId,
        creditExpenseTransactionId,
      );

    if (!creditExpenseTransaction)
      return left(new ResourceNotFoundError("transação"));

    const originTransaction =
      await this.deps.creditExpenseTransactionRepository.findUniqueOriginTransactionById(
        creditExpenseTransaction.id.value,
      );

    if (recurrence && !originTransaction)
      return left(new ResourceNotFoundError("transação"));

    const { creditCardId, categoryId, transactedAt, amount } = data;

    const isSingleUpdateAndTransactionAlreadyAccomplished =
      !recurrence && creditExpenseTransaction.isAccomplished;

    if (
      isSingleUpdateAndTransactionAlreadyAccomplished &&
      (creditCardId || transactedAt || amount)
    )
      return left(new ForbiddenActionError());

    if (creditCardId) {
      const creditCard =
        await this.deps.creditCardRepository.findUniqueActivatedFromUserById(
          userId,
          creditCardId,
        );

      if (!creditCard)
        return left(new ResourceNotFoundError("cartão de crédito"));
    }

    if (categoryId) {
      const transactionCategory =
        await this.deps.transactionCategoryRepository.findUniqueFromUserById(
          userId,
          categoryId,
        );

      if (!transactionCategory)
        return left(new ResourceNotFoundError("categoria de transação"));
    }

    await this.deps.unitOfWork.transaction(async () => {
      const updatedFields = creditExpenseTransaction.update(data);

      if (!recurrence) {
        await this.deps.creditExpenseTransactionRepository.update(
          creditExpenseTransaction,
          updatedFields,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.creditExpenseTransactionRepository.updateManyAccomplished(
          originTransaction!,
          updatedFields,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.creditExpenseTransactionRepository.updateManyPending(
          originTransaction!,
          updatedFields,
        );

        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: originTransaction!,
          applyTransaction: false,
          update: true,
        });
      }
    });

    return right({ creditExpenseTransaction });
  }
}
