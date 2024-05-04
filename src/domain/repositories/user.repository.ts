import { BaseRepository } from "@/core/repositories/base-repository";
import { User, UserDataUpdated, UserEntity } from "../entities/user.entity";

type CoreOperationsUserRepository = BaseRepository<
  UserEntity,
  User,
  UserDataUpdated
>;

export interface UserRepository extends CoreOperationsUserRepository {
  findUniqueById(userId: string): Promise<User | null>;
  findUniqueByEmail(email: string): Promise<User | null>;
}
