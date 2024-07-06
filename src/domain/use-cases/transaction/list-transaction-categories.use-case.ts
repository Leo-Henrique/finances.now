import { Either, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UseCase } from "@/core/use-case";
import { TransactionCategory } from "@/domain/entities/transaction-category.entity";
import { TransactionCategoryRepository } from "@/domain/repositories/transaction-category.repository";
import { z } from "zod";

const listTransactionCategoriesUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  expensesOnly: z.boolean(),
});

export type ListTransactionCategoriesUseCaseInput = z.infer<
  typeof listTransactionCategoriesUseCaseSchema
>;

type ListTransactionCategoriesUseCaseOutput = Either<
  null,
  { transactionCategories: TransactionCategory[] }
>;

type ListTransactionCategoriesUseCaseDeps = {
  transactionCategoryRepository: TransactionCategoryRepository;
};

export class ListTransactionCategoriesUseCase extends UseCase<
  ListTransactionCategoriesUseCaseInput,
  ListTransactionCategoriesUseCaseOutput,
  ListTransactionCategoriesUseCaseDeps
> {
  public constructor(deps: ListTransactionCategoriesUseCaseDeps) {
    super({ inputSchema: listTransactionCategoriesUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    expensesOnly,
  }: ListTransactionCategoriesUseCaseInput) {
    let transactionCategories: TransactionCategory[];

    if (expensesOnly) {
      transactionCategories =
        await this.deps.transactionCategoryRepository.findManyFromUserOfExpenses(
          userId,
        );
    } else {
      transactionCategories =
        await this.deps.transactionCategoryRepository.findManyFromUserOfEarning(
          userId,
        );
    }

    return right({ transactionCategories });
  }
}
