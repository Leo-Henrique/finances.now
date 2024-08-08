import { UserActivationToken } from "../entities/user-activation-token.entity";

export abstract class UserActivationTokenRepository {
  abstract create(userActivationToken: UserActivationToken): Promise<void>;
  abstract findUniqueByToken(
    token: string,
  ): Promise<UserActivationToken | null>;
  abstract activateUserAccount(
    userActivationToken: UserActivationToken,
  ): Promise<void>;
}
