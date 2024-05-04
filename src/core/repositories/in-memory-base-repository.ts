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

  public async create(entity: DomainEntity) {
    this.items.push(entity);
  }

  public async update(entity: DomainEntity, data: DataUpdated) {
    const entityIndex = this.items.findIndex(
      item => item.id.value === entity.id.value,
    );

    if (entityIndex < 0) return;

    for (const fieldName in data) {
      // @ts-expect-error: current field inference is unknown
      this.items[entityIndex][fieldName] = data[fieldName];
    }

    this.items.push(entity);
  }

  public async delete(entity: DomainEntity) {
    const entityIndex = this.items.findIndex(
      item => item.id.value === entity.id.value,
    );

    if (entityIndex < 0) return;

    this.items.splice(entityIndex, 1);
  }
}
