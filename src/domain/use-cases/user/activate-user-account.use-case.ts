import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { UserActivationTokenEntity } from "@/domain/entities/user-activation-token.entity";
import {
  ResourceNotFoundError,
  UserActivationTokenExpiredError,
} from "@/domain/errors";
import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { z } from "zod";

const activateUserAccountUseCaseSchema = z.object({
  token: UserActivationTokenEntity.baseSchema.shape.token,
});

type ActivateUserAccountUseCaseInput = z.infer<
  typeof activateUserAccountUseCaseSchema
>;

type ActivateUserAccountUseCaseOutput = Either<
  ResourceNotFoundError | UserActivationTokenExpiredError,
  null
>;

type ActivateUserAccountUseCaseDeps = {
  userActivationTokenRepository: UserActivationTokenRepository;
};

export class ActivateUserAccountUseCase extends UseCase<
  ActivateUserAccountUseCaseInput,
  ActivateUserAccountUseCaseOutput,
  ActivateUserAccountUseCaseDeps
> {
  public constructor(deps: ActivateUserAccountUseCaseDeps) {
    super({ inputSchema: activateUserAccountUseCaseSchema, deps });
  }

  protected async handle({ token }: ActivateUserAccountUseCaseInput) {
    const userActivationToken =
      await this.deps.userActivationTokenRepository.findUniqueByToken(token);

    if (!userActivationToken)
      return left(new ResourceNotFoundError("token de ativação de conta"));

    if (new Date() >= userActivationToken.expiresAt)
      return left(new UserActivationTokenExpiredError());

    await this.deps.userActivationTokenRepository.activateUserAccount(
      userActivationToken,
    );

    return right(null);
  }
}
