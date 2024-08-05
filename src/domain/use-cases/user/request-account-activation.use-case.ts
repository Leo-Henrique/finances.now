import { InferLeftReason } from "@/core/@types/either";
import { Either, left, right } from "@/core/either";
import { UseCase } from "@/core/use-case";
import {
  AccountActivationToken,
  AccountActivationTokenEntity,
} from "@/domain/entities/account-activation-token.entity";
import { User } from "@/domain/entities/user.entity";
import { Encryption } from "@/domain/gateways/auth/encryption";
import {
  EmailDispatcher,
  SendEmailToActivationAccountOutput,
} from "@/domain/gateways/email-dispatcher";
import { AccountActivationTokenRepository } from "@/domain/repositories/account-activation-token.repository";

type RequestAccountActivationUseCaseInput = {
  user: User;
};

export type RequestAccountActivationUseCaseOutput = Either<
  InferLeftReason<SendEmailToActivationAccountOutput>,
  { accountActivationToken: AccountActivationToken }
>;

type RequestAccountActivationUseCaseDeps = {
  accountActivationTokenRepository: AccountActivationTokenRepository;
  encryption: Encryption;
  emailDispatcher: EmailDispatcher;
};

export class RequestAccountActivationUseCase extends UseCase<
  RequestAccountActivationUseCaseInput,
  RequestAccountActivationUseCaseOutput,
  RequestAccountActivationUseCaseDeps
> {
  public constructor(deps: RequestAccountActivationUseCaseDeps) {
    super({ deps });
  }

  protected async handle({ user }: RequestAccountActivationUseCaseInput) {
    const token = await this.deps.encryption.encrypt(64);

    const accountActivationToken = AccountActivationTokenEntity.create({
      userId: user.id,
      token,
    });

    const sendEmailToActivationAccount =
      await this.deps.emailDispatcher.sendToActivationAccount(
        user,
        accountActivationToken,
      );

    if (sendEmailToActivationAccount.isLeft())
      return left(sendEmailToActivationAccount.reason);

    await this.deps.accountActivationTokenRepository.create(
      accountActivationToken,
    );

    return right({ accountActivationToken });
  }
}
