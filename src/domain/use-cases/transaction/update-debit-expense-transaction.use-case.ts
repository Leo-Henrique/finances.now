import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  DebitExpenseTransaction,
  DebitExpenseTransactionEntity,
} from "@/domain/entities/debit-expense-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { DebitExpenseTransactionRepository } from "@/domain/repositories/debit-expense-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const updateDebitExpenseTransactionUseCaseSchema = z
  .object({
    userId: UniqueEntityId.schema,
    debitExpenseTransactionId: UniqueEntityId.schema,
    recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
    data: DebitExpenseTransactionEntity.updateSchema.pick({
      bankAccountId: true,
      categoryId: true,
      amount: true,
      transactedAt: true,
      description: true,
    }),
  })
  .refine(output => {
    if (output.recurrence && output.data.bankAccountId) return false;

    if (output.recurrence && output.data.transactedAt) return false;

    if (
      (output.recurrence === "accomplished" || output.recurrence === "all") &&
      output.data.amount
    )
      return false;

    return true;
  });

export type UpdateDebitExpenseTransactionUseCaseInput = z.infer<
  typeof updateDebitExpenseTransactionUseCaseSchema
>;

type UpdateDebitExpenseTransactionUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
  {
    debitExpenseTransaction: DebitExpenseTransaction;
  }
>;

type UpdateDebitExpenseTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  debitExpenseTransactionRepository: DebitExpenseTransactionRepository;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
};

export class UpdateDebitExpenseTransactionUseCase extends UseCase<
  UpdateDebitExpenseTransactionUseCaseInput,
  UpdateDebitExpenseTransactionUseCaseOutput,
  UpdateDebitExpenseTransactionUseCaseDeps
> {
  public constructor(deps: UpdateDebitExpenseTransactionUseCaseDeps) {
    super({ inputSchema: updateDebitExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    debitExpenseTransactionId,
    recurrence,
    data,
  }: UpdateDebitExpenseTransactionUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const debitExpenseTransaction =
      await this.deps.debitExpenseTransactionRepository.findUniqueFromUserById(
        userId,
        debitExpenseTransactionId,
      );

    if (!debitExpenseTransaction)
      return left(new ResourceNotFoundError("transação"));

    const originTransaction =
      await this.deps.debitExpenseTransactionRepository.findUniqueOriginTransactionById(
        debitExpenseTransaction.id.value,
      );

    if (recurrence && !originTransaction)
      return left(new ResourceNotFoundError("transação"));

    const { bankAccountId, categoryId, amount } = data;

    if (bankAccountId) {
      const bankAccount =
        await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
          userId,
          bankAccountId,
        );

      if (!bankAccount)
        return left(new ResourceNotFoundError("conta bancária"));
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
      if (!recurrence && (bankAccountId || amount)) {
        await Promise.all([
          this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
            debitExpenseTransaction.bankAccountId.value,
            debitExpenseTransaction.amount,
          ),
          this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
            bankAccountId ?? debitExpenseTransaction.bankAccountId.value,
            amount ?? debitExpenseTransaction.amount,
          ),
        ]);
      }

      const updatedFields = debitExpenseTransaction.update(data);

      if (!recurrence) {
        await this.deps.debitExpenseTransactionRepository.update(
          debitExpenseTransaction,
          updatedFields,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.debitExpenseTransactionRepository.updateManyAccomplished(
          debitExpenseTransaction,
          updatedFields,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.debitExpenseTransactionRepository.updateManyPending(
          debitExpenseTransaction,
          updatedFields,
        );

        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: originTransaction!,
          applyTransaction: false,
          update: true,
        });
      }
    });

    return right({ debitExpenseTransaction });
  }
}
