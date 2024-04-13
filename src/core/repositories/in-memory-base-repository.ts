import { EntityDataUpdated, EntityInstance } from "@/core/@types/entity";
import { Entity } from "@/core/entities/entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { BaseRepository } from "./base-repository";

export abstract class InMemoryBaseRepository<
  Class extends Entity,
  DomainEntity extends EntityInstance<Class> & { id: UniqueEntityId },
  DataUpdated extends EntityDataUpdated<Class>,
> implements BaseRepository<Class, DomainEntity, DataUpdated>
{
  public items: DomainEntity[] = [];

  public async create(user: DomainEntity) {
    this.items.push(user);
  }

  public async update(user: DomainEntity, data: DataUpdated) {
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

  public async delete(user: DomainEntity) {
    const userIndex = this.items.findIndex(
      item => item.id.value === user.id.value,
    );

    if (userIndex < 0) return;

    this.items.splice(userIndex, 1);
  }

  public async findUniqueById(userId: string) {
    const user = this.items.find(item => item.id.value === userId);

    if (!user) return null;

    return user;
  }
}
