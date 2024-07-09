import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { TransferenceTransaction } from "@/domain/entities/transference-transaction.entity";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { TransferenceTransactionRepository } from "@/domain/repositories/transference-transaction.repository";
import { z } from "zod";

const accomplishTransferenceTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  transferenceTransactionId: UniqueEntityId.schema,
});

type AccomplishTransferenceTransactionUseCaseInput = z.infer<
  typeof accomplishTransferenceTransactionUseCaseSchema
>;

type AccomplishTransferenceTransactionUseCaseOutput = Either<
  ResourceNotFoundError | TransactionAlreadyAccomplishedError,
  { transferenceTransaction: TransferenceTransaction }
>;

type AccomplishTransferenceTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  transferenceTransactionRepository: TransferenceTransactionRepository;
  unitOfWork: UnitOfWork;
};

export class AccomplishTransferenceTransactionUseCase extends UseCase<
  AccomplishTransferenceTransactionUseCaseInput,
  AccomplishTransferenceTransactionUseCaseOutput,
  AccomplishTransferenceTransactionUseCaseDeps
> {
  public constructor(deps: AccomplishTransferenceTransactionUseCaseDeps) {
    super({
      inputSchema: accomplishTransferenceTransactionUseCaseSchema,
      deps,
    });
  }

  protected async handle({
    userId,
    transferenceTransactionId,
  }: AccomplishTransferenceTransactionUseCaseInput) {
    const transferenceTransaction =
      await this.deps.transferenceTransactionRepository.findUniqueFromUserById(
        userId,
        transferenceTransactionId,
      );

    if (!transferenceTransaction)
      return left(new ResourceNotFoundError("transação"));

    if (transferenceTransaction.isAccomplished)
      return left(new TransactionAlreadyAccomplishedError());

    await this.deps.unitOfWork.transaction(async () => {
      const updatedPaidStatus = transferenceTransaction.update({
        isAccomplished: true,
      });

      await Promise.all([
        this.deps.transferenceTransactionRepository.update(
          transferenceTransaction,
          updatedPaidStatus,
        ),
        this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
          transferenceTransaction.originBankAccountId.value,
          transferenceTransaction.amount,
        ),
        this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
          transferenceTransaction.destinyBankAccountId.value,
          transferenceTransaction.amount,
        ),
      ]);
    });

    return right({ transferenceTransaction });
  }
}
