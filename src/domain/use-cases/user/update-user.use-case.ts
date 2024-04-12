import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const updateUserUseCaseSchema = z.object({
  userId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  data: UserEntity.updateSchema.pick({ name: true }),
});

type UpdateUserUseCaseInput = z.infer<typeof updateUserUseCaseSchema>;

type UpdateUserUseCaseOutput = Either<
  ResourceNotFoundError | UnauthorizedError,
  {
    user: User["serialized"];
  }
>;

type UpdateUserUseCaseDeps = {
  userRepository: UserRepository;
};

export class UpdateUserUseCase extends UseCase<
  UpdateUserUseCaseInput,
  UpdateUserUseCaseOutput,
  UpdateUserUseCaseDeps
> {
  public constructor(deps: UpdateUserUseCaseDeps) {
    super({ inputSchema: updateUserUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    targetUserId,
    data,
  }: UpdateUserUseCaseInput): Promise<UpdateUserUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueById(targetUserId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    if (userId !== user.id.value) return left(new UnauthorizedError());

    const updatedFields = user.update(data);

    await this.deps.userRepository.update(user, updatedFields);

    return right({ user: user.serialized });
  }
}
