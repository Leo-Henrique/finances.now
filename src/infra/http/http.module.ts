import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { FastifyMulterEventModule } from "./events/fastify-multer.event.module";
import { DomainExceptionFilter } from "./filters/domain-exception.filter";
import { HttpExceptionFilter } from "./filters/http-exception.filter";
import { UserModule } from "./route-modules/user.module";

@Module({
  imports: [FastifyMulterEventModule, UserModule],
  providers: [
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class HttpModule {}
