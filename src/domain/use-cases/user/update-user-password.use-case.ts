import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import {
  NewPasswordSameAsCurrentError,
  ResourceNotFoundError,
  UnauthorizedError,
} from "@/domain/errors";
import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
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
  passwordHasher: PasswordHasher;
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

    const isValidCurrentPassword = await this.deps.passwordHasher.match(
      currentPassword,
      user.password.value,
    );

    if (!isValidCurrentPassword) return left(new UnauthorizedError());

    const newPasswordIsSameAsCurrent = await this.deps.passwordHasher.match(
      newPassword,
      user.password.value,
    );

    if (newPasswordIsSameAsCurrent)
      return left(new NewPasswordSameAsCurrentError());

    const newPasswordHashed = await this.deps.passwordHasher.hash(newPassword);

    const updatedFields = user.update({ password: newPasswordHashed });

    await this.deps.userRepository.update(user, updatedFields);

    return right({ user: user.serialized });
  }
}
