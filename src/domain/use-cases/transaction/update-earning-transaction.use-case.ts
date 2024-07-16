import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  EarningTransaction,
  EarningTransactionEntity,
} from "@/domain/entities/earning-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const updateEarningTransactionUseCaseSchema = z
  .object({
    userId: UniqueEntityId.schema,
    earningTransactionId: UniqueEntityId.schema,
    recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
    data: EarningTransactionEntity.updateSchema.pick({
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

export type UpdateEarningTransactionUseCaseInput = z.infer<
  typeof updateEarningTransactionUseCaseSchema
>;

type UpdateEarningTransactionUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
  {
    earningTransaction: EarningTransaction;
  }
>;

type UpdateEarningTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  earningTransactionRepository: EarningTransactionRepository;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
};

export class UpdateEarningTransactionUseCase extends UseCase<
  UpdateEarningTransactionUseCaseInput,
  UpdateEarningTransactionUseCaseOutput,
  UpdateEarningTransactionUseCaseDeps
> {
  public constructor(deps: UpdateEarningTransactionUseCaseDeps) {
    super({ inputSchema: updateEarningTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    earningTransactionId,
    recurrence,
    data,
  }: UpdateEarningTransactionUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const earningTransaction =
      await this.deps.earningTransactionRepository.findUniqueFromUserById(
        userId,
        earningTransactionId,
      );

    if (!earningTransaction)
      return left(new ResourceNotFoundError("transação"));

    const originTransaction =
      await this.deps.earningTransactionRepository.findUniqueOriginTransactionById(
        earningTransaction.id.value,
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
          this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
            earningTransaction.bankAccountId.value,
            earningTransaction.amount,
          ),
          this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
            bankAccountId ?? earningTransaction.bankAccountId.value,
            amount ?? earningTransaction.amount,
          ),
        ]);
      }

      const updatedFields = earningTransaction.update(data);

      if (!recurrence) {
        await this.deps.earningTransactionRepository.update(
          earningTransaction,
          updatedFields,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.earningTransactionRepository.updateManyAccomplished(
          originTransaction!,
          updatedFields,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.earningTransactionRepository.updateManyPending(
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

    return right({ earningTransaction });
  }
}
