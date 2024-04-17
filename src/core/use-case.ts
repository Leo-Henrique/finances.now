import { z } from "zod";
import {
  Either,
  ExpectedResultOfEither,
  InferResultOfEither,
  left,
  right,
} from "./either";
import { DomainError } from "./errors/domain-error";
import { ValidationError } from "./errors/errors";

type UseCaseInputSchema<Input> = z.ZodObject<{
  [K in keyof Input]: z.ZodType<Input[K]>;
}>;

type UseCaseDependencies = object;

export abstract class UseCase<
  Input,
  Output extends Either<DomainError | null, object>,
  Dependencies extends UseCaseDependencies | undefined = undefined,
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
    type Result = InferResultOfEither<
      Either<ValidationError, Input>,
      ExpectedResult
    >;

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
    type Result = InferResultOfEither<Output, Expected>;

    let validInput: Input = input;

    if (this.inputSchema) {
      const validatedInput = this.validate(this.inputSchema, input);

      if (validatedInput.isLeft()) return left(validatedInput.reason) as Result;

      validInput = validatedInput.result;
    }

    return (await this.handle(validInput)) as Result;
  }
}
