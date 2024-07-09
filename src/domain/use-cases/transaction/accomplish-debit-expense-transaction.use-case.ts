import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { DebitExpenseTransaction } from "@/domain/entities/debit-expense-transaction.entity";
import {
  ResourceNotFoundError,
  TransactionAlreadyAccomplishedError,
} from "@/domain/errors";
import { BankAccountRepository } from "@/domain/repositories/bank-account.repository";
import { DebitExpenseTransactionRepository } from "@/domain/repositories/debit-expense-transaction.repository";
import { z } from "zod";

const accomplishDebitExpenseTransactionUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  debitExpenseTransactionId: UniqueEntityId.schema,
});

type AccomplishDebitExpenseTransactionUseCaseInput = z.infer<
  typeof accomplishDebitExpenseTransactionUseCaseSchema
>;

type AccomplishDebitExpenseTransactionUseCaseOutput = Either<
  ResourceNotFoundError | TransactionAlreadyAccomplishedError,
  { debitExpenseTransaction: DebitExpenseTransaction }
>;

type AccomplishDebitExpenseTransactionUseCaseDeps = {
  bankAccountRepository: BankAccountRepository;
  debitExpenseTransactionRepository: DebitExpenseTransactionRepository;
  unitOfWork: UnitOfWork;
};

export class AccomplishDebitExpenseTransactionUseCase extends UseCase<
  AccomplishDebitExpenseTransactionUseCaseInput,
  AccomplishDebitExpenseTransactionUseCaseOutput,
  AccomplishDebitExpenseTransactionUseCaseDeps
> {
  public constructor(deps: AccomplishDebitExpenseTransactionUseCaseDeps) {
    super({
      inputSchema: accomplishDebitExpenseTransactionUseCaseSchema,
      deps,
    });
  }

  protected async handle({
    userId,
    debitExpenseTransactionId,
  }: AccomplishDebitExpenseTransactionUseCaseInput) {
    const debitExpenseTransaction =
      await this.deps.debitExpenseTransactionRepository.findUniqueFromUserById(
        userId,
        debitExpenseTransactionId,
      );

    if (!debitExpenseTransaction)
      return left(new ResourceNotFoundError("transação"));

    if (debitExpenseTransaction.isAccomplished)
      return left(new TransactionAlreadyAccomplishedError());

    await this.deps.unitOfWork.transaction(async () => {
      const updatedPaidStatus = debitExpenseTransaction.update({
        isAccomplished: true,
      });

      await Promise.all([
        this.deps.debitExpenseTransactionRepository.update(
          debitExpenseTransaction,
          updatedPaidStatus,
        ),
        this.deps.bankAccountRepository.updateUniqueByIdDecreasingBalance(
          debitExpenseTransaction.bankAccountId.value,
          debitExpenseTransaction.amount,
        ),
      ]);
    });

    return right({ debitExpenseTransaction });
  }
}
