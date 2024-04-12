import { User, UserDataUpdated } from "../entities/user.entity";

export interface UserRepository {
  create(user: User): Promise<void>;
  update(user: User, data: UserDataUpdated): Promise<void>;
  delete(user: User): Promise<void>;
  findUniqueById(id: User["id"]["value"]): Promise<User | null>;
  findUniqueByEmail(email: User["email"]): Promise<User | null>;
}
