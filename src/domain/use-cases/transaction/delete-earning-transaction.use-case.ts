import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { ResourceNotFoundError } from "@/domain/errors";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";

const deleteEarningTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  earningTransactionId: UniqueEntityId.schema,
  recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
});

type DeleteEarningTransactionUseCaseInput = z.infer<
  typeof deleteEarningTransactionUseCaseSchema
>;

type DeleteEarningTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  null
>;

type DeleteEarningTransactionUseCaseDeps = {
  earningTransactionRepository: EarningTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
};

export class DeleteEarningTransactionUseCase extends UseCase<
  DeleteEarningTransactionUseCaseInput,
  DeleteEarningTransactionUseCaseOutput,
  DeleteEarningTransactionUseCaseDeps
> {
  public constructor(deps: DeleteEarningTransactionUseCaseDeps) {
    super({ inputSchema: deleteEarningTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    earningTransactionId,
    recurrence,
  }: DeleteEarningTransactionUseCaseInput) {
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

    await this.deps.unitOfWork.transaction(async () => {
      if (!recurrence) {
        await this.deps.earningTransactionRepository.delete(earningTransaction);
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.earningTransactionRepository.deleteManyAccomplished(
          earningTransaction,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.earningTransactionRepository.deleteManyPending(
          earningTransaction,
        );

        await this.deps.jobSchedulingService.deleteManyByKey(
          originTransaction!.id.value,
        );
      }
    });

    return right(null);
  }
}
