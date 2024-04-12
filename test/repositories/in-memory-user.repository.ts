import { User, UserDataUpdated } from "@/domain/entities/user.entity";
import { UserRepository } from "@/domain/repositories/user.repository";

export class InMemoryUserRepository implements UserRepository {
  public items: User[] = [];

  async create(user: User) {
    this.items.push(user);
  }

  async update(user: User, data: UserDataUpdated) {
    const userIndex = this.items.findIndex(
      item => item.id.value === user.id.value,
    );

    if (userIndex < 0) return;

    for (const fieldName in data) {
      // @ts-expect-error: current field inference is unknown
      this.items[userIndex][fieldName] = data[fieldName];
    }

    this.items.push(user);
  }

  async delete(user: User) {
    const userIndex = this.items.findIndex(
      item => item.id.value === user.id.value,
    );

    if (userIndex < 0) return;

    this.items.splice(userIndex, 1);
  }

  async findUniqueById(userId: User["id"]["value"]) {
    const user = this.items.find(item => item.id.value === userId);

    if (!user) return null;

    return user;
  }

  async findUniqueByEmail(email: string) {
    const user = this.items.find(item => item.email === email);

    if (!user) return null;

    return user;
  }
}
