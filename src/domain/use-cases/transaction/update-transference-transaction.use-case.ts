import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  TransferenceTransaction,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const updateTransferenceTransactionUseCaseSchema = z
  .object({
    userId: UniqueEntityId.schema,
    transferenceTransactionId: UniqueEntityId.schema,
    recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
    data: TransferenceTransactionEntity.updateSchema.pick({
      originBankAccountId: true,
      destinyBankAccountId: true,
      amount: true,
      transactedAt: true,
      description: true,
    }),
  })
  .refine(output => {
    if (output.recurrence && output.data.originBankAccountId) return false;

    if (output.recurrence && output.data.destinyBankAccountId) return false;

    if (output.recurrence && output.data.transactedAt) return false;

    if (
      (output.recurrence === "accomplished" || output.recurrence === "all") &&
      output.data.amount
    )
      return false;

    return true;
  });

export type UpdateTransferenceTransactionUseCaseInput = z.infer<
  typeof updateTransferenceTransactionUseCaseSchema
>;

type UpdateTransferenceTransactionUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
  {
    transferenceTransaction: TransferenceTransaction;
  }
>;

type UpdateTransferenceTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transactionCategoryRepository: TransactionCategoryRepository;
  transferenceTransactionRepository: TransferenceTransactionRepository;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
};

export class UpdateTransferenceTransactionUseCase extends UseCase<
  UpdateTransferenceTransactionUseCaseInput,
  UpdateTransferenceTransactionUseCaseOutput,
  UpdateTransferenceTransactionUseCaseDeps
> {
  public constructor(deps: UpdateTransferenceTransactionUseCaseDeps) {
    super({ inputSchema: updateTransferenceTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    transferenceTransactionId,
    recurrence,
    data,
  }: UpdateTransferenceTransactionUseCaseInput) {
    if (!Object.keys(data).length) return left(new ValidationError());

    const transferenceTransaction =
      await this.deps.transferenceTransactionRepository.findUniqueFromUserById(
        userId,
        transferenceTransactionId,
      );

    if (!transferenceTransaction)
      return left(new ResourceNotFoundError("transação"));

    const originTransaction =
      await this.deps.transferenceTransactionRepository.findUniqueOriginTransactionById(
        transferenceTransaction.id.value,
      );

    if (recurrence && !originTransaction)
      return left(new ResourceNotFoundError("transação"));

    const { originBankAccountId, destinyBankAccountId, amount } = data;

    if (originBankAccountId) {
      const originBankAccount =
        await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
          userId,
          originBankAccountId,
        );

      if (!originBankAccount)
        return left(new ResourceNotFoundError("conta bancária"));
    }

    if (destinyBankAccountId) {
      const destinyBankAccount =
        await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
          userId,
          destinyBankAccountId,
        );

      if (!destinyBankAccount)
        return left(new ResourceNotFoundError("conta bancária"));
    }

    await this.deps.unitOfWork.transaction(async () => {
      if (
        !recurrence &&
        (originBankAccountId || destinyBankAccountId || amount)
      ) {
        await Promise.all([
          this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
            transferenceTransaction.originBankAccountId.value,
            transferenceTransaction.amount,
          ),
          this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
            transferenceTransaction.destinyBankAccountId.value,
            transferenceTransaction.amount,
          ),
        ]);

        await Promise.all([
          this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
            originBankAccountId ??
              transferenceTransaction.originBankAccountId.value,
            amount ?? transferenceTransaction.amount,
          ),
          this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
            destinyBankAccountId ??
              transferenceTransaction.destinyBankAccountId.value,
            amount ?? transferenceTransaction.amount,
          ),
        ]);
      }

      const updatedFields = transferenceTransaction.update(data);

      if (!recurrence) {
        await this.deps.transferenceTransactionRepository.update(
          transferenceTransaction,
          updatedFields,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.transferenceTransactionRepository.updateManyAccomplished(
          originTransaction!,
          updatedFields,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.transferenceTransactionRepository.updateManyPending(
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

    return right({ transferenceTransaction });
  }
}
