import {
  RegisterUserUseCase,
  registerUserUseCaseSchema,
} from "@/domain/use-cases/user/register-user.use-case";
import { extendApi } from "@anatine/zod-openapi";
import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ZodSchemaPipe } from "../../middlewares/zod-schema-pipe";

export const registerUserControllerBodySchema =
  registerUserUseCaseSchema.extend({
    name: extendApi(registerUserUseCaseSchema.shape.name, {
      example: "John Doe",
    }),
  });

type RegisterUserControllerBody = z.infer<
  typeof registerUserControllerBodySchema
>;

@Controller()
export class RegisterUserController {
  constructor(private readonly registerUserUseCase: RegisterUserUseCase) {}

  @ApiTags("User")
  @ApiOperation({ summary: "Register a user." })
  @Post("/users")
  @HttpCode(201)
  @ZodSchemaPipe({
    body: registerUserControllerBodySchema,
  })
  async handle(@Body() body: RegisterUserControllerBody) {
    await this.registerUserUseCase.unsafeExecute(body);
  }
}
