import { Either } from "@/core/either";
import { UserActivationToken } from "../entities/user-activation-token.entity";
import { User } from "../entities/user.entity";
import { FailedToSendEmailForActivationAccountError } from "../errors";

export type SendEmailToActivationAccountOutput = Either<
  FailedToSendEmailForActivationAccountError,
  null
>;

export abstract class EmailDispatcher {
  abstract sendToActivationAccount(
    recipient: User,
    accountActivationToken: UserActivationToken,
  ): Promise<SendEmailToActivationAccountOutput>;
}
