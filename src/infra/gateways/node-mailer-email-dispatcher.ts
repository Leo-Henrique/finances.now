import { right } from "@/core/either";
import { UserActivationToken } from "@/domain/entities/user-activation-token.entity";
import { User } from "@/domain/entities/user.entity";
import {
  EmailDispatcher,
  SendEmailToActivationAccountOutput,
} from "@/domain/gateways/email-dispatcher";
import { Injectable } from "@nestjs/common";

@Injectable()
export class NodeMailerEmailDispatcher implements EmailDispatcher {
  public async sendToActivationAccount(
    recipient: User,
    accountActivationToken: UserActivationToken,
  ): Promise<SendEmailToActivationAccountOutput> {
    console.log("ENVIAR EMAIL");

    return right(null);
  }
}
