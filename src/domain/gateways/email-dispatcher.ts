import { Either } from "@/core/either";
import { AccountActivationToken } from "../entities/account-activation-token.entity";
import { User } from "../entities/user.entity";
import { FailedToSendEmailForActivationAccountError } from "../errors";

export type SendEmailToActivationAccountOutput = Either<
  FailedToSendEmailForActivationAccountError,
  null
>;

export interface EmailDispatcher {
  sendToActivationAccount(
    recipient: User,
    accountActivationToken: AccountActivationToken,
  ): Promise<SendEmailToActivationAccountOutput>;
}
