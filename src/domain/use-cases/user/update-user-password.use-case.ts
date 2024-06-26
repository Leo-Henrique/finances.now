import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
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
  userId: UniqueEntityId.schema,
  currentPassword: UserEntity.baseSchema.shape.password,
  newPassword: UserEntity.baseSchema.shape.password,
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
    currentPassword,
    newPassword,
  }: UpdateUserPasswordUseCaseInput): Promise<UpdateUserPasswordUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

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
