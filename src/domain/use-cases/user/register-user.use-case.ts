import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { ResourceAlreadyExistsError } from "@/domain/errors";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const registerUserUseCaseSchema = UserEntity.createSchema;

type RegisterUserUseCaseInput = z.infer<typeof registerUserUseCaseSchema>;

type RegisterUserUseCaseOutput = Either<
  ResourceAlreadyExistsError,
  {
    user: User["serialized"];
  }
>;

type RegisterUserUseCaseDeps = {
  userRepository: UserRepository;
};

export class RegisterUserUseCase extends UseCase<
  RegisterUserUseCaseInput,
  RegisterUserUseCaseOutput,
  RegisterUserUseCaseDeps
> {
  public constructor(deps: RegisterUserUseCaseDeps) {
    super({ inputSchema: registerUserUseCaseSchema, deps });
  }

  protected async handle({ email, ...restInput }: RegisterUserUseCaseInput) {
    const userWithSameEmail =
      await this.deps.userRepository.findUniqueByEmail(email);

    if (userWithSameEmail)
      return left(new ResourceAlreadyExistsError("usuário"));

    const user = UserEntity.create({ email, ...restInput });

    await this.deps.userRepository.create(user);

    return right({ user: user.serialized });
  }
}
