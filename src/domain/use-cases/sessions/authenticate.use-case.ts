import { InferLeftReason } from "@/core/@types/either";
import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import { SessionEntity } from "@/domain/entities/session.entity";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { ForbiddenActionError, InvalidCredentialsError } from "@/domain/errors";
import { Encryption } from "@/domain/gateways/cryptology/encryption";
import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
import { SessionRepository } from "@/domain/repositories/session.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { z } from "zod";
import {
  RequestAccountActivationUseCaseOutput,
  RequestUserAccountActivationUseCase,
} from "../user/request-user-account-activation.use-case";

const authenticateUseCaseSchema = UserEntity.createSchema.pick({
  email: true,
  password: true,
});

type AuthenticateUseCaseInput = z.infer<typeof authenticateUseCaseSchema>;

type AuthenticateUseCaseOutput = Either<
  | InvalidCredentialsError
  | InferLeftReason<RequestAccountActivationUseCaseOutput>
  | ForbiddenActionError,
  {
    user: User["serialized"];
    token: string;
  }
>;

type AuthenticateUseCaseDeps = {
  userRepository: UserRepository;
  passwordHasher: PasswordHasher;
  requestAccountActivationUseCase: RequestUserAccountActivationUseCase;
  encryption: Encryption;
  sessionRepository: SessionRepository;
};

export class AuthenticateUseCase extends UseCase<
  AuthenticateUseCaseInput,
  AuthenticateUseCaseOutput,
  AuthenticateUseCaseDeps
> {
  public constructor(deps: AuthenticateUseCaseDeps) {
    super({ inputSchema: authenticateUseCaseSchema, deps });
  }

  protected async handle({ email, password }: AuthenticateUseCaseInput) {
    const user = await this.deps.userRepository.findUniqueByEmail(email);

    if (!user) return left(new InvalidCredentialsError());

    const isValidPassword = await this.deps.passwordHasher.match(
      password,
      user.password.value,
    );

    if (!isValidPassword) return left(new InvalidCredentialsError());

    if (!user.activatedAt) {
      const requestAccountActivationUseCase =
        await this.deps.requestAccountActivationUseCase.execute({ user });

      if (requestAccountActivationUseCase.isLeft())
        return left(requestAccountActivationUseCase.reason);

      return left(
        new ForbiddenActionError(
          "O e-mail da sua conta ainda não foi confirmado, verifique sua caixa de entrada para que você possa ativar sua conta.",
        ),
      );
    }

    const token = await this.deps.encryption.encrypt(128);
    const session = SessionEntity.create({ userId: user.id, token });

    await this.deps.sessionRepository.create(session);

    return right({ user: user.serialized, token: session.token });
  }
}
