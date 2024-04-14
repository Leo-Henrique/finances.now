import { InMemoryBaseRepository } from "@/core/repositories/in-memory-base-repository";
import {
  User,
  UserDataUpdated,
  UserEntity,
} from "@/domain/entities/user.entity";
import { UserRepository } from "@/domain/repositories/user.repository";

export class InMemoryUserRepository
  extends InMemoryBaseRepository<UserEntity, User, UserDataUpdated>
  implements UserRepository
{
  public async findUniqueByEmail(email: User["email"]) {
    const user = this.items.find(item => item.email === email);

    if (!user) return null;

    return user;
  }
}
