import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { EarningTransaction } from "@/domain/entities/earning-transaction.entity";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { EarningTransactionRepository } from "@/domain/repositories/earning-transaction.repository";
import { z } from "zod";

const accomplishEarningTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  earningTransactionId: UniqueEntityId.schema,
});

type AccomplishEarningTransactionUseCaseInput = z.infer<
  typeof accomplishEarningTransactionUseCaseSchema
>;

type AccomplishEarningTransactionUseCaseOutput = Either<
  ResourceNotFoundError | TransactionAlreadyAccomplishedError,
  { earningTransaction: EarningTransaction }
>;

type AccomplishEarningTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  earningTransactionRepository: EarningTransactionRepository;
  unitOfWork: UnitOfWork;
};

export class AccomplishEarningTransactionUseCase extends UseCase<
  AccomplishEarningTransactionUseCaseInput,
  AccomplishEarningTransactionUseCaseOutput,
  AccomplishEarningTransactionUseCaseDeps
> {
  public constructor(deps: AccomplishEarningTransactionUseCaseDeps) {
    super({ inputSchema: accomplishEarningTransactionUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    earningTransactionId,
  }: AccomplishEarningTransactionUseCaseInput) {
    const earningTransaction =
      await this.deps.earningTransactionRepository.findUniqueFromUserById(
        userId,
        earningTransactionId,
      );

    if (!earningTransaction)
      return left(new ResourceNotFoundError("transação"));

    if (earningTransaction.isAccomplished)
      return left(new TransactionAlreadyAccomplishedError());

    await this.deps.unitOfWork.transaction(async () => {
      const updatedPaidStatus = earningTransaction.update({
        isAccomplished: true,
      });

      await Promise.all([
        this.deps.earningTransactionRepository.update(
          earningTransaction,
          updatedPaidStatus,
        ),
        this.deps.bankAccountRepository.updateUniqueByIdIncreasingBalance(
          earningTransaction.bankAccountId.value,
          earningTransaction.amount,
        ),
      ]);
    });

    return right({ earningTransaction });
  }
}
