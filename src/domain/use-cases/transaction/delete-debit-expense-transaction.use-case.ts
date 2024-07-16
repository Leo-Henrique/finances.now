import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { ResourceNotFoundError } from "@/domain/errors";
import { DebitExpenseTransactionRepository } from "@/domain/repositories/debit-expense-transaction.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const deleteDebitExpenseTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  debitExpenseTransactionId: UniqueEntityId.schema,
  recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
});

type DeleteDebitExpenseTransactionUseCaseInput = z.infer<
  typeof deleteDebitExpenseTransactionUseCaseSchema
>;

type DeleteDebitExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  null
>;

type DeleteDebitExpenseTransactionUseCaseDeps = {
  debitExpenseTransactionRepository: DebitExpenseTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class DeleteDebitExpenseTransactionUseCase extends UseCase<
  DeleteDebitExpenseTransactionUseCaseInput,
  DeleteDebitExpenseTransactionUseCaseOutput,
  DeleteDebitExpenseTransactionUseCaseDeps
> {
  public constructor(deps: DeleteDebitExpenseTransactionUseCaseDeps) {
    super({ inputSchema: deleteDebitExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    debitExpenseTransactionId,
    recurrence,
  }: DeleteDebitExpenseTransactionUseCaseInput) {
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

    await this.deps.unitOfWork.transaction(async () => {
      if (!recurrence) {
        await this.deps.debitExpenseTransactionRepository.delete(
          debitExpenseTransaction,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.debitExpenseTransactionRepository.deleteManyAccomplished(
          debitExpenseTransaction,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.debitExpenseTransactionRepository.deleteManyPending(
          debitExpenseTransaction,
        );

        await this.deps.jobSchedulingService.deleteManyByKey(
          originTransaction!.id.value,
        );
      }
    });

    return right(null);
  }
}
