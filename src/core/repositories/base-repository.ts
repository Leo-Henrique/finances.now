import { EntityDataUpdated, EntityInstance } from "../@types/entity";
import { Entity } from "../entities/entity";
import { UniqueEntityId } from "../entities/unique-entity-id";

export abstract class BaseRepository<
  Class extends Entity,
  DomainEntity extends EntityInstance<Class> & { id: UniqueEntityId },
  DataUpdated extends EntityDataUpdated<Class>,
> {
  abstract create(domainEntity: DomainEntity): Promise<void>;
  abstract update(domainEntity: DomainEntity, data: DataUpdated): Promise<void>;
  abstract delete(domainEntity: DomainEntity): Promise<void>;
}
