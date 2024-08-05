import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UseCase } from "@/core/use-case";
import { AccountActivationTokenEntity } from "@/domain/entities/account-activation-token.entity";
import {
  AccountActivationTokenExpiredError,
  ResourceNotFoundError,
} from "@/domain/errors";
import { AccountActivationTokenRepository } from "@/domain/repositories/account-activation-token.repository";
import { z } from "zod";

const activateAccountUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  token: AccountActivationTokenEntity.baseSchema.shape.token,
});

type ActivateAccountUseCaseInput = z.infer<typeof activateAccountUseCaseSchema>;

type ActivateAccountUseCaseOutput = Either<
  ResourceNotFoundError | AccountActivationTokenExpiredError,
  null
>;

type ActivateAccountUseCaseDeps = {
  accountActivationTokenRepository: AccountActivationTokenRepository;
};

export class ActivateAccountUseCase extends UseCase<
  ActivateAccountUseCaseInput,
  ActivateAccountUseCaseOutput,
  ActivateAccountUseCaseDeps
> {
  public constructor(deps: ActivateAccountUseCaseDeps) {
    super({ inputSchema: activateAccountUseCaseSchema, deps });
  }

  protected async handle({ userId, token }: ActivateAccountUseCaseInput) {
    const accountActivationToken =
      await this.deps.accountActivationTokenRepository.findUniqueFromUserByToken(
        userId,
        token,
      );

    if (!accountActivationToken)
      return left(new ResourceNotFoundError("token de ativação de conta"));

    if (new Date() >= accountActivationToken.expiresAt)
      return left(new AccountActivationTokenExpiredError());

    await this.deps.accountActivationTokenRepository.activateUserAccount(
      accountActivationToken,
    );

    return right(null);
  }
}
