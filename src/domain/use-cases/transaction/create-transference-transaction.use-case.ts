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

const createTransferenceTransactionUseCaseSchema =
  TransferenceTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateTransferenceTransactionUseCaseInput = z.infer<
  typeof createTransferenceTransactionUseCaseSchema
>;

export type CreateTransferenceTransactionUseCaseOutput = Either<
  ResourceNotFoundError | FailedToCreateTransactionError,
  { transferenceTransaction: TransferenceTransaction }
>;

type CreateTransferenceTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transferenceTransactionRepository: TransferenceTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class CreateTransferenceTransactionUseCase extends UseCase<
  CreateTransferenceTransactionUseCaseInput,
  CreateTransferenceTransactionUseCaseOutput,
  CreateTransferenceTransactionUseCaseDeps
> {
  public constructor(deps: CreateTransferenceTransactionUseCaseDeps) {
    super({ inputSchema: createTransferenceTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    originBankAccountId,
    destinyBankAccountId,
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
      ...restInput,
    });
    const { isAccomplished, amount, recurrencePeriod, recurrenceLimit } =
      transferenceTransaction;

    try {
      await this.deps.unitOfWork.begin();

      await this.deps.transferenceTransactionRepository.create(
        transferenceTransaction,
      );

      if (isAccomplished) {
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
      }

      if (recurrencePeriod) {
        await this.deps.transferenceTransactionRepository.createManyOfRecurrence(
          transferenceTransaction,
        );

        if (!recurrenceLimit) {
          const middleTransactionOfCurrentRecurrence =
            await this.deps.transferenceTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
              transferenceTransaction.id.value,
            );

          if (!middleTransactionOfCurrentRecurrence) {
            throw new Error(
              "Failed to get middle transaction of current recurrence.",
            );
          }

          await this.deps.jobSchedulingService.createRepeatableByDynamicDate(
            async () => {
              const endTransactionOfCurrentRecurrence =
                await this.deps.transferenceTransactionRepository.findUniqueEndOfCurrentRecurrence(
                  transferenceTransaction.id.value,
                );

              if (!endTransactionOfCurrentRecurrence) return null;

              await this.deps.transferenceTransactionRepository.createManyOfRecurrence(
                transferenceTransaction,
                endTransactionOfCurrentRecurrence.transactedAt,
              );

              const middleTransactionOfCurrentRecurrence =
                await this.deps.transferenceTransactionRepository.findUniqueMiddleOfCurrentRecurrence(
                  transferenceTransaction.id.value,
                );

              if (!middleTransactionOfCurrentRecurrence) return null;

              return middleTransactionOfCurrentRecurrence.transactedAt;
            },
            middleTransactionOfCurrentRecurrence.transactedAt,
            {
              key: transferenceTransaction.id.value,
            },
          );
        }
      }

      await this.deps.unitOfWork.commit();

      return right({ transferenceTransaction });
    } catch (error) {
      await this.deps.unitOfWork.rollback();
      await this.deps.jobSchedulingService.deleteManyByKey(
        transferenceTransaction.id.value,
      );

      return left(new FailedToCreateTransactionError(error));
    }
  }
}
