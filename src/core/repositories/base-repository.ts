import { EntityDataUpdated, EntityInstance } from "../@types/entity";
import { Entity } from "../entities/entity";
import { UniqueEntityId } from "../entities/unique-entity-id";

export interface BaseRepository<
  Class extends Entity,
  DomainEntity extends EntityInstance<Class> & { id: UniqueEntityId },
  DataUpdated extends EntityDataUpdated<Class>,
> {
  create(domainEntity: DomainEntity): Promise<void>;
  update(domainEntity: DomainEntity, data: DataUpdated): Promise<void>;
  delete(domainEntity: DomainEntity): Promise<void>;
}
