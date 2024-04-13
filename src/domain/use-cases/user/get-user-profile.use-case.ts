import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { User } from "@/domain/entities/user.entity";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const getUserProfileUseCaseSchema = z.object({
  userId: z.string().uuid(),
  targetUserId: z.string().uuid(),
});

type GetUserProfileUseCaseInput = z.infer<typeof getUserProfileUseCaseSchema>;

type GetUserProfileUseCaseOutput = Either<
  ResourceNotFoundError | UnauthorizedError,
  {
    user: User["serialized"];
  }
>;

type GetUserProfileUseCaseDeps = {
  userRepository: UserRepository;
};

export class GetUserProfileUseCase extends UseCase<
  GetUserProfileUseCaseInput,
  GetUserProfileUseCaseOutput,
  GetUserProfileUseCaseDeps
> {
  public constructor(deps: GetUserProfileUseCaseDeps) {
    super({ inputSchema: getUserProfileUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    targetUserId,
  }: GetUserProfileUseCaseInput): Promise<GetUserProfileUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueById(targetUserId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    if (userId !== user.id.value) return left(new UnauthorizedError());

    return right({ user: user.serialized });
  }
}
