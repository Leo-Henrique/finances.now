import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { SessionEntity } from "@/domain/entities/session.entity";
import { User } from "@/domain/entities/user.entity";
import { UnauthorizedError } from "@/domain/errors";
import { SessionRepository } from "@/domain/repositories/session.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const getAuthenticatedUserUseCaseSchema = z.object({
  token: SessionEntity.baseSchema.shape.token,
});

type GetAuthenticatedUserUseCaseInput = z.infer<
  typeof getAuthenticatedUserUseCaseSchema
>;

type GetAuthenticatedUserUseCaseOutput = Either<
  UnauthorizedError,
  {
    user: User["serialized"];
  }
>;

type GetAuthenticatedUserUseCaseDeps = {
  sessionRepository: SessionRepository;
  userRepository: UserRepository;
};

export class GetAuthenticatedUserUseCase extends UseCase<
  GetAuthenticatedUserUseCaseInput,
  GetAuthenticatedUserUseCaseOutput,
  GetAuthenticatedUserUseCaseDeps
> {
  public constructor(deps: GetAuthenticatedUserUseCaseDeps) {
    super({ inputSchema: getAuthenticatedUserUseCaseSchema, deps });
  }

  protected async handle({ token }: GetAuthenticatedUserUseCaseInput) {
    const session = await this.deps.sessionRepository.findUniqueByToken(token);

    if (!session) return left(new UnauthorizedError());

    const user = await this.deps.userRepository.findUniqueById(
      session.userId.value,
    );

    if (!user) return left(new UnauthorizedError());

    if (new Date() >= session.expiresAt) return left(new UnauthorizedError());

    await this.deps.sessionRepository.updateUniqueToRenew(session);

    return right({ user: user.serialized });
  }
}
