import { BaseRepository } from "@/core/repositories/base-repository";
import { User, UserDataUpdated, UserEntity } from "../entities/user.entity";

type CoreOperationsUserRepository = BaseRepository<
  UserEntity,
  User,
  UserDataUpdated
>;

export interface UserRepository extends CoreOperationsUserRepository {
  findUniqueByEmail(email: User["email"]): Promise<User | null>;
}
