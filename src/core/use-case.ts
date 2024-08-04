import { z } from "zod";
import { ExpectedResultOfEither, InferEither } from "./@types/either";
import { Either, EitherReason, EitherResult, left, right } from "./either";
import { ValidationError } from "./errors/errors";

type UseCaseInputSchema<Input> =
  | z.ZodObject<{
      [K in keyof Input]: z.ZodType<Input[K]>;
    }>
  | z.ZodEffects<
      z.ZodObject<{
        [K in keyof Input]: z.ZodType<Input[K]>;
      }>
    >;

export abstract class UseCase<
  Input extends object | null,
  Output extends Either<EitherReason, EitherResult>,
  Dependencies extends object | undefined = undefined,
> {
  private inputSchema: UseCaseInputSchema<Input> | undefined = undefined;
  protected deps!: Dependencies;

  protected constructor({
    inputSchema,
    deps,
  }: {
    inputSchema?: UseCaseInputSchema<Input>;
    deps?: Dependencies;
  } = {}) {
    if (inputSchema) this.inputSchema = inputSchema;
    if (deps) this.deps = deps;
  }

  private validate<ExpectedResult extends ExpectedResultOfEither = "unknown">(
    schema: NonNullable<typeof this.inputSchema>,
    input: Input,
  ) {
    type Result = InferEither<Either<ValidationError, Input>, ExpectedResult>;

    const parsedInput = schema.safeParse(input);

    if (!parsedInput.success) {
      return left(
        new ValidationError(parsedInput.error.flatten().fieldErrors),
      ) as Result;
    }

    return right(parsedInput.data) as Result;
  }

  protected abstract handle(input: Input): Promise<Output>;

  public async execute<Expected extends ExpectedResultOfEither>(input: Input) {
    type Result = InferEither<Output, Expected>;

    let validInput: Input = input;

    if (this.inputSchema) {
      const validatedInput = this.validate(this.inputSchema, input);

      if (validatedInput.isLeft()) return left(validatedInput.reason) as Result;

      validInput = validatedInput.result;
    }

    return (await this.handle(validInput)) as Result;
  }
}
