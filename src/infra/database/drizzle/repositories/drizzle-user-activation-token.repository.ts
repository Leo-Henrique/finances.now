import {
  UserActivationToken,
  UserActivationTokenEntity,
} from "@/domain/entities/user-activation-token.entity";
import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { Injectable } from "@nestjs/common";
import { sql } from "drizzle-orm";
import {} from "drizzle-orm/pg-core";
import { DrizzleService } from "../drizzle.service";
import { DrizzleUserActivationTokenData } from "../schemas/user-activation-token.schema";

@Injectable()
export class DrizzleUserActivationTokenRepository
  implements UserActivationTokenRepository
{
  public constructor(private readonly drizzle: DrizzleService) {}

  public async create(userActivationToken: UserActivationToken): Promise<void> {
    const query = sql`
      INSERT INTO user_activation_tokens 
        (
          user_id,
          expires_at
        )
      VALUES
        (
          ${userActivationToken.userId.value},
          ${userActivationToken.token},
          ${userActivationToken.expiresAt}
        )
    `;

    await this.drizzle.query(query);
  }

  public async findUniqueByToken(
    token: string,
  ): Promise<UserActivationToken | null> {
    const query = sql`
      SELECT
        *
      FROM
        user_activation_tokens
      WHERE
        token = ${token}
    `;
    const [userActivationToken] =
      await this.drizzle.query<DrizzleUserActivationTokenData>(query);

    if (!userActivationToken) return null;

    return UserActivationTokenEntity.create(
      null,
      userActivationToken,
    );
  }

  // TODO: receber opção para ativar ou não transação
  // public async activateUserAccount(
  //   userActivationToken: UserActivationToken,
  // ): Promise<void> {
  //   const query = sql`
  //     DELETE FROM
  //       user_activation_tokens
  //     WHERE
  //       token = ${userActivationToken.token}
  //   `;
  //   const [userActivationToken] =
  //     await this.drizzle.query<DrizzleUserActivationTokenData>(query);

  //   if (!user) return;

  //   const updatedFields = user.update({ activatedAt: new Date() });

  //   await this.deps.userRepository.update(user, updatedFields);
  // }
}
