import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { ResourceNotFoundError } from "@/domain/errors";
import { JobScheduling } from "@/domain/gateways/job-scheduling";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";
import { z } from "zod";

const deleteTransferenceTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  transferenceTransactionId: UniqueEntityId.schema,
  recurrence: z.enum(["accomplished", "pending", "all"]).optional(),
});

type DeleteTransferenceTransactionUseCaseInput = z.infer<
  typeof deleteTransferenceTransactionUseCaseSchema
>;

type DeleteTransferenceTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  null
>;

type DeleteTransferenceTransactionUseCaseDeps = {
  transferenceTransactionRepository: TransferenceTransactionRepository;
  jobScheduling: JobScheduling;
  unitOfWork: UnitOfWork;
};

export class DeleteTransferenceTransactionUseCase extends UseCase<
  DeleteTransferenceTransactionUseCaseInput,
  DeleteTransferenceTransactionUseCaseOutput,
  DeleteTransferenceTransactionUseCaseDeps
> {
  public constructor(deps: DeleteTransferenceTransactionUseCaseDeps) {
    super({ inputSchema: deleteTransferenceTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    transferenceTransactionId,
    recurrence,
  }: DeleteTransferenceTransactionUseCaseInput) {
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

    await this.deps.unitOfWork.transaction(async () => {
      if (!recurrence) {
        await this.deps.transferenceTransactionRepository.delete(
          transferenceTransaction,
        );
      }

      if (recurrence === "accomplished" || recurrence === "all") {
        await this.deps.transferenceTransactionRepository.deleteManyAccomplished(
          transferenceTransaction,
        );
      }

      if (recurrence === "pending" || recurrence === "all") {
        await this.deps.transferenceTransactionRepository.deleteManyPending(
          transferenceTransaction,
        );

        await this.deps.jobScheduling.deleteManyByKey(
          originTransaction!.id.value,
        );
      }
    });

    return right(null);
  }
}
