import { AccountActivationToken } from "@/domain/entities/account-activation-token.entity";
import { AccountActivationTokenRepository } from "@/domain/repositories/account-activation-token.repository";
import { UserRepository } from "@/domain/repositories/user.repository";

type InMemoryAccountActivationTokenRepositoryDeps = {
  userRepository: UserRepository;
};

export class InMemoryAccountActivationTokenRepository
  implements AccountActivationTokenRepository
{
  public items: AccountActivationToken[] = [];

  public constructor(
    private deps: InMemoryAccountActivationTokenRepositoryDeps,
  ) {}

  public async create(accountActivationToken: AccountActivationToken) {
    this.items.push(accountActivationToken);
  }

  public async findUniqueFromUserByToken(userId: string, token: string) {
    const accountActivationToken = this.items.find(
      item => item.userId.value === userId && item.token === token,
    );

    return accountActivationToken ?? null;
  }

  public async activateUserAccount(
    accountActivationToken: AccountActivationToken,
  ) {
    this.items = this.items.filter(
      item => item.userId.value !== accountActivationToken.userId.value,
    );

    const user = await this.deps.userRepository.findUniqueById(
      accountActivationToken.userId.value,
    );

    if (!user) return;

    const updatedFields = user.update({ activatedAt: new Date() });

    await this.deps.userRepository.update(user, updatedFields);
  }
}
