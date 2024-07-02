import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  TransferenceTransaction,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";

import {
  FailedToCreateTransactionError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const CreateTransferenceTransactionUseCaseSchema =
  TransferenceTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateTransferenceTransactionUseCaseInput = z.infer<
  typeof CreateTransferenceTransactionUseCaseSchema
>;

export type CreateTransferenceTransactionUseCaseOutput = Either<
  ResourceNotFoundError | FailedToCreateTransactionError,
  { transferenceTransaction: TransferenceTransaction }
>;

type CreateTransferenceTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transferenceTransactionRepository: TransferenceTransactionRepository;
  taskSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class CreateTransferenceTransactionUseCase extends UseCase<
  CreateTransferenceTransactionUseCaseInput,
  CreateTransferenceTransactionUseCaseOutput,
  CreateTransferenceTransactionUseCaseDeps
> {
  public constructor(deps: CreateTransferenceTransactionUseCaseDeps) {
    super({ inputSchema: CreateTransferenceTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    originBankAccountId,
    destinyBankAccountId,
    transactedAt,
    amount,
    recurrencePeriod,
    recurrenceAmount,
    recurrenceLimit,
    ...restInput
  }: CreateTransferenceTransactionUseCaseInput) {
    const originBankAccount =
      await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
        userId,
        originBankAccountId,
      );

    if (!originBankAccount)
      return left(new ResourceNotFoundError("conta bancária"));

    const destinyBankAccount =
      await this.deps.bankAccountRepository.findUniqueActivatedFromUserById(
        userId,
        destinyBankAccountId,
      );

    if (!destinyBankAccount)
      return left(new ResourceNotFoundError("conta bancária"));

    const transferenceTransaction = TransferenceTransactionEntity.create({
      originBankAccountId,
      destinyBankAccountId,
      transactedAt,
      amount,
      recurrencePeriod,
      recurrenceAmount,
      recurrenceLimit,
      ...restInput,
    });

    try {
      await this.deps.unitOfWork.begin();

      const transference = async () => {
        await Promise.all([
          this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
            originBankAccountId,
            amount,
          ),
          this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
            destinyBankAccountId,
            amount,
          ),
        ]);
      };

      if (transactedAt <= new Date()) {
        await transference();
      } else {
        await this.deps.taskSchedulingService.createUnique(
          transference,
          transactedAt,
          { key: transferenceTransaction.id.value },
        );
      }

      if (recurrencePeriod) {
        await this.deps.taskSchedulingService.createRepeatableByPeriod(
          transference,
          {
            key: transferenceTransaction.id.value,
            period: recurrencePeriod,
            fromDate: transactedAt,
            ...(recurrenceAmount && { amount: recurrenceAmount }),
            ...(recurrenceLimit && { limit: recurrenceLimit }),
          },
        );
      }

      await this.deps.transferenceTransactionRepository.create(
        transferenceTransaction,
      );

      await this.deps.unitOfWork.commit();

      return right({ transferenceTransaction });
    } catch {
      await this.deps.unitOfWork.rollback();
      await this.deps.taskSchedulingService.deleteManyByKey(
        transferenceTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError());
    }
  }
}
