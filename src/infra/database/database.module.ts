import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { UserRepository } from "@/domain/repositories/user.repository";
import { Module, Provider } from "@nestjs/common";
import { DrizzleService } from "./drizzle/drizzle.service";
import { DrizzleUserActivationTokenRepository } from "./drizzle/repositories/drizzle-user-activation-token.repository";
import { DrizzleUserRepository } from "./drizzle/repositories/drizzle-user.repository";

const gatewaysProviders = [
  {
    provide: UserRepository,
    useClass: DrizzleUserRepository,
  },
  {
    provide: UserActivationTokenRepository,
    useClass: DrizzleUserActivationTokenRepository,
  },
] satisfies Provider[];

@Module({
  providers: [DrizzleService, ...gatewaysProviders],
  exports: [DrizzleService, ...gatewaysProviders.map(({ provide }) => provide)],
})
export class DatabaseModule {}
