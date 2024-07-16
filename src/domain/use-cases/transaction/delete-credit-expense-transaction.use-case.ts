import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { ForbiddenActionError, ResourceNotFoundError } from "@/domain/errors";
import { CreditExpenseTransactionRepository } from "@/domain/repositories/credit-expense-transaction.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const deleteCreditExpenseTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  creditExpenseTransactionId: UniqueEntityId.schema,
  recurrence: z.enum(["pending"]).optional(),
});

type DeleteCreditExpenseTransactionUseCaseInput = z.infer<
  typeof deleteCreditExpenseTransactionUseCaseSchema
>;

type DeleteCreditExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError | ForbiddenActionError,
  null
>;

type DeleteCreditExpenseTransactionUseCaseDeps = {
  creditExpenseTransactionRepository: CreditExpenseTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class DeleteCreditExpenseTransactionUseCase extends UseCase<
  DeleteCreditExpenseTransactionUseCaseInput,
  DeleteCreditExpenseTransactionUseCaseOutput,
  DeleteCreditExpenseTransactionUseCaseDeps
> {
  public constructor(deps: DeleteCreditExpenseTransactionUseCaseDeps) {
    super({ inputSchema: deleteCreditExpenseTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    creditExpenseTransactionId,
    recurrence,
  }: DeleteCreditExpenseTransactionUseCaseInput) {
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

    if (!recurrence && creditExpenseTransaction.isAccomplished)
      return left(new ForbiddenActionError());

    await this.deps.unitOfWork.transaction(async () => {
      if (!recurrence) {
        await this.deps.creditExpenseTransactionRepository.delete(
          creditExpenseTransaction,
        );
      } else {
        await this.deps.creditExpenseTransactionRepository.deleteManyPending(
          creditExpenseTransaction,
        );

        await this.deps.jobSchedulingService.deleteManyByKey(
          originTransaction!.id.value,
        );
      }
    });

    return right(null);
  }
}
