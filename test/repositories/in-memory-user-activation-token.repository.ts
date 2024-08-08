import { UserActivationToken } from "@/domain/entities/user-activation-token.entity";
import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { UserRepository } from "@/domain/repositories/user.repository";

type InMemoryUserActivationTokenRepositoryDeps = {
  userRepository: UserRepository;
};

export class InMemoryUserActivationTokenRepository
  implements UserActivationTokenRepository
{
  public items: UserActivationToken[] = [];

  public constructor(private deps: InMemoryUserActivationTokenRepositoryDeps) {}

  public async create(userActivationToken: UserActivationToken) {
    this.items.push(userActivationToken);
  }

  public async findUniqueByToken(token: string) {
    const userActivationToken = this.items.find(item => item.token === token);

    return userActivationToken ?? null;
  }

  public async activateUserAccount(userActivationToken: UserActivationToken) {
    this.items = this.items.filter(
      item => item.userId.value !== userActivationToken.userId.value,
    );

    const user = await this.deps.userRepository.findUniqueById(
      userActivationToken.userId.value,
    );

    if (!user) return;

    const updatedFields = user.update({ activatedAt: new Date() });

    await this.deps.userRepository.update(user, updatedFields);
  }
}
