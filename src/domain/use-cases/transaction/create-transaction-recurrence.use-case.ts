import { Either, right } from "@/core/either";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { Transaction } from "@/domain/entities/transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { TransactionRecurrenceRepository } from "@/domain/repositories/transaction-recurrence.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";

type CreateTransactionRecurrenceUseCaseInput = {
  originTransaction: Transaction;
  applyTransaction: boolean;
  update?: boolean;
};

export type CreateTransactionRecurrenceUseCaseOutput = Either<
  ResourceNotFoundError,
  null
>;

type CreateTransactionRecurrenceUseCaseDeps = {
  transactionRecurrenceRepository: TransactionRecurrenceRepository<Transaction>;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class CreateTransactionRecurrenceUseCase extends UseCase<
  CreateTransactionRecurrenceUseCaseInput,
  CreateTransactionRecurrenceUseCaseOutput,
  CreateTransactionRecurrenceUseCaseDeps
> {
  public constructor(deps: CreateTransactionRecurrenceUseCaseDeps) {
    super({ deps });
  }

  protected async handle({
    originTransaction,
    applyTransaction,
    update,
  }: CreateTransactionRecurrenceUseCaseInput) {
    const { recurrenceLimit } = originTransaction;
    const handleRecurrence = async () => {
      if (update) {
        await this.deps.jobSchedulingService.deleteManyByKey(
          originTransaction.id.value,
        );
      } else {
        await this.deps.transactionRecurrenceRepository.createManyOfRecurrence(
          originTransaction,
        );
      }

      if (!recurrenceLimit) {
        const middleTransactionOfCurrentRecurrence =
          await this.deps.transactionRecurrenceRepository.findUniqueMiddleOfCurrentRecurrence(
            originTransaction.id.value,
          );

        if (!middleTransactionOfCurrentRecurrence) {
          throw new Error(
            "Failed to get middle transaction of current recurrence.",
          );
        }

        await this.deps.jobSchedulingService.createRepeatableByDynamicDate(
          async () => {
            const endTransactionOfCurrentRecurrence =
              await this.deps.transactionRecurrenceRepository.findUniqueEndOfCurrentRecurrence(
                originTransaction.id.value,
              );

            if (!endTransactionOfCurrentRecurrence) return null;

            await this.deps.transactionRecurrenceRepository.createManyOfRecurrence(
              originTransaction,
              endTransactionOfCurrentRecurrence.transactedAt,
            );

            const middleTransactionOfCurrentRecurrence =
              await this.deps.transactionRecurrenceRepository.findUniqueMiddleOfCurrentRecurrence(
                originTransaction.id.value,
              );

            if (!middleTransactionOfCurrentRecurrence) return null;

            return middleTransactionOfCurrentRecurrence.transactedAt;
          },
          middleTransactionOfCurrentRecurrence.transactedAt,
          {
            key: originTransaction.id.value,
          },
        );
      }
    };

    if (applyTransaction) {
      await this.deps.unitOfWork.transaction(handleRecurrence);
    } else {
      await handleRecurrence();
    }

    return right(null);
  }
}
