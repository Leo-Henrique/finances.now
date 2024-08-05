import { right } from "@/core/either";
import { AccountActivationToken } from "@/domain/entities/account-activation-token.entity";
import { User } from "@/domain/entities/user.entity";
import { EmailDispatcher } from "@/domain/gateways/email-dispatcher";

interface FakeEmail {
  recipientId: string;
  content: string;
}

export class FakeEmailDispatcher implements EmailDispatcher {
  public inbox: FakeEmail[] = [];

  public async sendToActivationAccount(
    recipient: User,
    accountActivationToken: AccountActivationToken,
  ) {
    this.inbox.push({
      recipientId: recipient.id.value,
      content: accountActivationToken.token,
    });

    return right(null);
  }
}
