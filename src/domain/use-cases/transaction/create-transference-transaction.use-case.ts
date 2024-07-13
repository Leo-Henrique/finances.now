import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import {
  TransferenceTransaction,
  TransferenceTransactionEntity,
} from "@/domain/entities/transference-transaction.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";
import { JobSchedulingService } from "@/domain/services/job-scheduling.service";
import { z } from "zod";
import { CreateTransactionRecurrenceUseCase } from "./create-transaction-recurrence.use-case";

const createTransferenceTransactionUseCaseSchema =
  TransferenceTransactionEntity.createSchema.extend({
    userId: UniqueEntityId.schema,
  });

type CreateTransferenceTransactionUseCaseInput = z.infer<
  typeof createTransferenceTransactionUseCaseSchema
>;

export type CreateTransferenceTransactionUseCaseOutput = Either<
  ResourceNotFoundError,
  { transferenceTransaction: TransferenceTransaction }
>;

type CreateTransferenceTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transferenceTransactionRepository: TransferenceTransactionRepository;
  jobSchedulingService: JobSchedulingService;
  unitOfWork: UnitOfWork;
  createTransactionRecurrenceUseCase: CreateTransactionRecurrenceUseCase;
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
    const { isAccomplished, amount, recurrencePeriod } =
      transferenceTransaction;

    await this.deps.unitOfWork.transaction(async () => {
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
        await this.deps.createTransactionRecurrenceUseCase.execute({
          originTransaction: transferenceTransaction,
          applyTransaction: false,
        });
      }
    });

    return right({ transferenceTransaction });
  }
}
