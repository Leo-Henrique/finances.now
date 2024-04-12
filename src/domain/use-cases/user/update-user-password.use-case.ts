import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import {
  NewPasswordSameAsCurrentError,
  ResourceNotFoundError,
  UnauthorizedError,
} from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const updateUserPasswordUseCaseSchema = z.object({
  userId: z.string().uuid(),
  targetUserId: z.string().uuid(),
  currentPassword: UserEntity.createSchema.shape.password,
  newPassword: UserEntity.createSchema.shape.password,
});

type UpdateUserPasswordUseCaseInput = z.infer<
  typeof updateUserPasswordUseCaseSchema
>;

type UpdateUserPasswordUseCaseOutput = Either<
  ResourceNotFoundError | UnauthorizedError | NewPasswordSameAsCurrentError,
  {
    user: User["serialized"];
  }
>;

type UpdateUserPasswordUseCaseDeps = {
  userRepository: UserRepository;
};

export class UpdateUserPasswordUseCase extends UseCase<
  UpdateUserPasswordUseCaseInput,
  UpdateUserPasswordUseCaseOutput,
  UpdateUserPasswordUseCaseDeps
> {
  public constructor(deps: UpdateUserPasswordUseCaseDeps) {
    super({ inputSchema: updateUserPasswordUseCaseSchema, deps });
  }

  protected async handle({
    userId,
    targetUserId,
    currentPassword,
    newPassword,
  }: UpdateUserPasswordUseCaseInput): Promise<UpdateUserPasswordUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueById(targetUserId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    if (userId !== user.id.value) return left(new UnauthorizedError());

    const isValidCurrentPassword = user.password.match(currentPassword);

    if (!isValidCurrentPassword) return left(new UnauthorizedError());

    const newPasswordIsSameAsCurrent = user.password.match(newPassword);

    if (newPasswordIsSameAsCurrent)
      return left(new NewPasswordSameAsCurrentError());

    const updatedFields = user.update({ password: newPassword });

    await this.deps.userRepository.update(user, updatedFields);

    return right({ user: user.serialized });
  }
}
