import { InferLeftReason } from "@/core/@types/either";
import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import {
  UserActivationToken,
  UserActivationTokenEntity,
} from "@/domain/entities/user-activation-token.entity";

import { User } from "@/domain/entities/user.entity";
import { Encryption } from "@/domain/gateways/cryptology/encryption";
import {
  EmailDispatcher,
  SendEmailToActivationAccountOutput,
} from "@/domain/gateways/email-dispatcher";

type RequestUserAccountActivationUseCaseInput = {
  user: User;
};

export type RequestUserAccountActivationUseCaseOutput = Either<
  InferLeftReason<SendEmailToActivationAccountOutput>,
  { userActivationToken: UserActivationToken }
>;

type RequestUserAccountActivationUseCaseDeps = {
  encryption: Encryption;
  emailDispatcher: EmailDispatcher;
};

export class RequestUserAccountActivationUseCase extends UseCase<
  RequestUserAccountActivationUseCaseInput,
  RequestUserAccountActivationUseCaseOutput,
  RequestUserAccountActivationUseCaseDeps
> {
  public constructor(deps: RequestUserAccountActivationUseCaseDeps) {
    super({ deps });
  }

  protected async handle({ user }: RequestUserAccountActivationUseCaseInput) {
    const token = await this.deps.encryption.encrypt(64);

    const userActivationToken = UserActivationTokenEntity.create({
      userId: user.id.value,
      token,
    });

    const sendEmailToActivationAccount =
      await this.deps.emailDispatcher.sendToActivationAccount(
        user,
        userActivationToken,
      );

    if (sendEmailToActivationAccount.isLeft())
      return left(sendEmailToActivationAccount.reason);

    return right({ userActivationToken });
  }
}
