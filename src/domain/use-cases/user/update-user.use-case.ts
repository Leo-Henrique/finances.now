import { Either, left, right } from "@/core/either";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { ValidationError } from "@/core/errors/errors";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { ResourceNotFoundError } from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const updateUserUseCaseSchema = z.object({
  userId: UniqueEntityId.schema,
  data: UserEntity.updateSchema.pick({ name: true }),
});

type UpdateUserUseCaseInput = z.infer<typeof updateUserUseCaseSchema>;

type UpdateUserUseCaseOutput = Either<
  ValidationError | ResourceNotFoundError,
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
    data,
  }: UpdateUserUseCaseInput): Promise<UpdateUserUseCaseOutput> {
    if (!Object.keys(data).length) return left(new ValidationError());

    const user = await this.deps.userRepository.findUniqueById(userId);

    if (!user) return left(new ResourceNotFoundError("usuário"));

    const updatedFields = user.update(data);

    await this.deps.userRepository.update(user, updatedFields);

    return right({ user: user.serialized });
  }
}
