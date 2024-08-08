import { BaseRepository } from "@/core/repositories/base-repository";
import { User, UserDataUpdated, UserEntity } from "../entities/user.entity";

export abstract class UserRepository extends BaseRepository<
  UserEntity,
  User,
  UserDataUpdated
> {
  abstract findUniqueById(userId: string): Promise<User | null>;
  abstract findUniqueByEmail(email: string): Promise<User | null>;
}
