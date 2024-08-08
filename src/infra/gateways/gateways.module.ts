import { UnitOfWork } from "@/core/unit-of-work";
import { EmailDispatcher } from "@/domain/gateways/email-dispatcher";
import { Module } from "@nestjs/common";
import { DrizzleService } from "../database/drizzle/drizzle.service";
import { InfraUnitOfWork } from "./infra-unit-of-work";
import { NodeMailerEmailDispatcher } from "./node-mailer-email-dispatcher";

@Module({
  providers: [
    DrizzleService,
    {
      provide: UnitOfWork,
      useClass: InfraUnitOfWork,
    },
    {
      provide: EmailDispatcher,
      useClass: NodeMailerEmailDispatcher,
    },
  ],
  exports: [UnitOfWork, EmailDispatcher],
})
export class GatewaysModule {}
