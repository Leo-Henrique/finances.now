import { InferLeftReason } from "@/core/@types/either";
import { Either, left, right } from "@/core/either";
import { UnitOfWork } from "@/core/unit-of-work";
import { UseCase } from "@/core/use-case";
import { User, UserEntity } from "@/domain/entities/user.entity";
import { ResourceAlreadyExistsError } from "@/domain/errors";
import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  RequestUserAccountActivationUseCase,
  RequestUserAccountActivationUseCaseOutput,
} from "./request-user-account-activation.use-case";

export const registerUserUseCaseSchema = UserEntity.createSchema.pick({
  email: true,
  password: true,
  name: true,
});

type RegisterUserUseCaseInput = z.infer<typeof registerUserUseCaseSchema>;

type RegisterUserUseCaseOutput = Either<
  | ResourceAlreadyExistsError
  | InferLeftReason<RequestUserAccountActivationUseCaseOutput>,
  {
    user: User["serialized"];
  }
>;

type RegisterUserUseCaseDeps = {
  userRepository: UserRepository;
  userActivationTokenRepository: UserActivationTokenRepository;
  passwordHasher: PasswordHasher;
  unitOfWork: UnitOfWork;
  requestUserAccountActivationUseCase: RequestUserAccountActivationUseCase;
};

@Injectable()
export class RegisterUserUseCase extends UseCase<
  RegisterUserUseCaseInput,
  RegisterUserUseCaseOutput,
  RegisterUserUseCaseDeps
> {
  public constructor(deps: RegisterUserUseCaseDeps) {
    super({ inputSchema: registerUserUseCaseSchema, deps });
  }

  protected async handle({
    email,
    password,
    ...restInput
  }: RegisterUserUseCaseInput) {
    const userWithSameEmail =
      await this.deps.userRepository.findUniqueByEmail(email);

    if (userWithSameEmail)
      return left(new ResourceAlreadyExistsError("usuário"));

    const passwordHashed = await this.deps.passwordHasher.hash(password);

    const user = UserEntity.create({
      ...restInput,
      email,
      password: passwordHashed,
    });

    try {
      await this.deps.unitOfWork.begin();

      const requestAccountActivationUseCase =
        await this.deps.requestUserAccountActivationUseCase.execute({ user });

      if (requestAccountActivationUseCase.isLeft())
        return left(requestAccountActivationUseCase.reason);

      const { userActivationToken } = requestAccountActivationUseCase.result;

      await this.deps.userRepository.create(user);
      await this.deps.userActivationTokenRepository.create(userActivationToken);

      await this.deps.unitOfWork.commit();
    } catch (err) {
      await this.deps.unitOfWork.rollback();
      throw err;
    }

    return right({ user: user.serialized });
  }
}
