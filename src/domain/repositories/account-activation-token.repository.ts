import { AccountActivationToken } from "../entities/account-activation-token.entity";

export interface AccountActivationTokenRepository {
  create(accountActivationToken: AccountActivationToken): Promise<void>;
  findUniqueFromUserByToken(
    userId: string,
    token: string,
  ): Promise<AccountActivationToken | null>;
  activateUserAccount(
    accountActivationToken: AccountActivationToken,
  ): Promise<void>;
}
