import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { InvalidCredentialsError } from "@/domain/errors";
import { PasswordHasher } from "@/domain/gateways/password-hasher";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";

const authenticateUserUseCaseSchema = UserEntity.createSchema.pick({
  email: true,
  password: true,
});

type AuthenticateUserUseCaseInput = z.infer<
  typeof authenticateUserUseCaseSchema
>;

type AuthenticateUserUseCaseOutput = Either<
  InvalidCredentialsError,
  {
    user: User["serialized"];
  }
>;

type AuthenticateUserUseCaseDeps = {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
};

export class AuthenticateUserUseCase extends UseCase<
  AuthenticateUserUseCaseInput,
  AuthenticateUserUseCaseOutput,
  AuthenticateUserUseCaseDeps
> {
  public constructor(deps: AuthenticateUserUseCaseDeps) {
    super({ inputSchema: authenticateUserUseCaseSchema, deps });
  }

  protected async handle({
    email,
    password,
  }: AuthenticateUserUseCaseInput): Promise<AuthenticateUserUseCaseOutput> {
    const user = await this.deps.userRepository.findUniqueByEmail(email);

    if (!user) return left(new InvalidCredentialsError());

    const isValidPassword = await this.deps.passwordHasher.match(
      password,
      user.password.value,
    );

    if (!isValidPassword) return left(new InvalidCredentialsError());

    return right({ user: user.serialized });
  }
}
