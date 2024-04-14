import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { UserEntity } from "@/domain/entities/user.entity";
import { ResourceNotFoundError, UnauthorizedError } from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const deleteUserUseCaseSchema = z.object({
  userId: z.string().uuid(),
  currentPassword: UserEntity.baseSchema.shape.password,
});

type DeleteUserUseCaseInput = z.infer<typeof deleteUserUseCaseSchema>;

type DeleteUserUseCaseOutput = Either<
  ResourceNotFoundError | UnauthorizedError,
  Record<never, never>
>;

type DeleteUserUseCaseDeps = {
  userRepository: UserRepository;
};

export class DeleteUserUseCase extends UseCase<
  DeleteUserUseCaseInput,
  DeleteUserUseCaseOutput,
  DeleteUserUseCaseDeps
> {
  public constructor(deps: DeleteUserUseCaseDeps) {
    super({ inputSchema: deleteUserUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    currentPassword,
  }: DeleteUserUseCaseInput): Promise<DeleteUserUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    const isValidCurrentPassword = user.password.match(currentPassword);

    if (!isValidCurrentPassword) return left(new UnauthorizedError());

    await this.deps.userRepository.delete(user);

    return right({});
  }
}
