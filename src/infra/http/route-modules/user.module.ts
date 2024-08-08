import { UnitOfWork } from "@/core/unit-of-work";
import { Encryption } from "@/domain/gateways/cryptology/encryption";
import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
import { EmailDispatcher } from "@/domain/gateways/email-dispatcher";

import { UserRepository } from "@/domain/repositories/user.repository";
import { RegisterUserUseCase } from "@/domain/use-cases/user/register-user.use-case";

import { UserActivationTokenRepository } from "@/domain/repositories/user-activation-token.repository";
import { RequestUserAccountActivationUseCase } from "@/domain/use-cases/user/request-user-account-activation.use-case";
import { CryptologyModule } from "@/infra/cryptology/cryptology.module";
import { DatabaseModule } from "@/infra/database/database.module";
import { GatewaysModule } from "@/infra/gateways/gateways.module";
import { Module } from "@nestjs/common";
import { RegisterUserController } from "../controllers/user/register-user.controller";

@Module({
  imports: [DatabaseModule, CryptologyModule, GatewaysModule],
  controllers: [RegisterUserController],
  providers: [
    {
      provide: RequestUserAccountActivationUseCase,
      useFactory: (
        encryption: Encryption,
        emailDispatcher: EmailDispatcher,
      ) => {
        return new RequestUserAccountActivationUseCase({
          encryption,
          emailDispatcher,
        });
      },
      inject: [Encryption, EmailDispatcher],
    },
    {
      provide: RegisterUserUseCase,
      useFactory: (
        userRepository: UserRepository,
        userActivationTokenRepository: UserActivationTokenRepository,
        passwordHasher: PasswordHasher,
        unitOfWork: UnitOfWork,
        requestUserAccountActivationUseCase: RequestUserAccountActivationUseCase,
      ) => {
        return new RegisterUserUseCase({
          userRepository,
          userActivationTokenRepository,
          passwordHasher,
          unitOfWork,
          requestUserAccountActivationUseCase,
        });
      },
      inject: [
        UserRepository,
        UserActivationTokenRepository,
        PasswordHasher,
        UnitOfWork,
        RequestUserAccountActivationUseCase,
      ],
    },
  ],
})
export class UserModule {}
