import { Mapper } from "@/core/mapper";
import {
  User,
  UserDataUpdated,
  UserEntity,
} from "@/domain/entities/user.entity";
import { UserRepository } from "@/domain/repositories/user.repository";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { DrizzleService } from "../drizzle.service";
import { DrizzleUserData } from "../schemas/user.schema";

@Injectable()
export class DrizzleUserRepository implements UserRepository {
  public constructor(private readonly drizzle: DrizzleService) {}

  public async create(user: User): Promise<void> {
    const query = sql`
      INSERT INTO users
        (
          id,
          email,
          password,
          name,
          activated_at,
          updated_at,
          created_at
        )
      VALUES
        (
          ${user.id.value},
          ${user.email},
          ${user.password.value},
          ${user.name.value},
          ${user.activatedAt},
          ${user.updatedAt},
          ${user.createdAt}
        );
    `;

    await this.drizzle.query(query);
  }

  public async update(user: User, data: UserDataUpdated): Promise<void> {
    // TODO: user.updatedAt = data.updatedAt
    const query = sql`      
      UPDATE
        users
      SET
        updated_at = ${user.updatedAt}
    `;

    for (let updateFieldName in data) {
      updateFieldName = Mapper.toSnakeCase(updateFieldName);

      query.append(sql`
        , ${updateFieldName} = ${data[updateFieldName as keyof UserDataUpdated]}
      `);
    }

    query.append(sql`WHERE id = ${user.id}`);

    await this.drizzle.query(query);
  }

  public async delete(user: User): Promise<void> {
    const query = sql`
      DELETE FROM 
        users
      WHERE
        id = ${user.id}
    `;

    await this.drizzle.query(query);
  }

  public async findUniqueById(userId: string): Promise<User | null> {
    const query = sql`
      SELECT
        *
      FROM
        users
      WHERE
        id = ${userId}
    `;
    const [user] = await this.drizzle.query<DrizzleUserData>(query);

    if (!user) return null;

    return UserEntity.create(user.id, user);
  }

  public async findUniqueByEmail(email: User["email"]): Promise<User | null> {
    const query = sql`
      SELECT
        *
      FROM
        users
      WHERE
        email = ${email}
    `;
    const [user] = await this.drizzle.query<DrizzleUserData>(query);

    if (!user) return null;

    return UserEntity.create(user.id, user);
  }
}
