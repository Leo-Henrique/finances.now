import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { SessionEntity } from "@/domain/entities/session.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { SessionRepository } from "@/domain/repositories/session.repository";
import { z } from "zod";

const revokeSessionUseCaseSchema = z.object({
  token: SessionEntity.baseSchema.shape.token,
});

type RevokeSessionUseCaseInput = z.infer<typeof revokeSessionUseCaseSchema>;

type RevokeSessionUseCaseOutput = Either<ResourceNotFoundError, null>;

type RevokeSessionUseCaseDeps = {
  sessionRepository: SessionRepository;
};

export class RevokeSessionUseCase extends UseCase<
  RevokeSessionUseCaseInput,
  RevokeSessionUseCaseOutput,
  RevokeSessionUseCaseDeps
> {
  public constructor(deps: RevokeSessionUseCaseDeps) {
    super({ inputSchema: revokeSessionUseCaseSchema, deps });
  }

  protected async handle({ token }: RevokeSessionUseCaseInput) {
    const session = await this.deps.sessionRepository.findUniqueByToken(token);

    if (!session) return left(new ResourceNotFoundError("sessão"));

    await this.deps.sessionRepository.updateUniqueToRevoke(session);

    return right(null);
  }
}
