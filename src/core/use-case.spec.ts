import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Either, left, right } from "./either";
import { DomainError } from "./errors/domain-error";
import { ValidationError } from "./errors/errors";
import { UseCase } from "./use-case";

class FakeError extends DomainError {
  public error = "FakeError";
  public debug = null;

  constructor() {
    super("Fake error.");
  }
}

const fakeUseCaseSchema = z.object({ success: z.boolean() });

type FakeUseCaseInput = z.infer<typeof fakeUseCaseSchema>;

type FakeUseCaseOutput = Either<
  FakeError,
  { input: FakeUseCaseInput; ok: true }
>;

export class FakeUseCase extends UseCase<FakeUseCaseInput, FakeUseCaseOutput> {
  public constructor() {
    super({ inputSchema: fakeUseCaseSchema });
  }

  protected async handle(input: FakeUseCaseInput) {
    if (!input.success) return left(new FakeError());

    return right({ input, ok: true } as const);
  }
}

let sut: FakeUseCase;

describe("[Core] Use Case", () => {
  beforeEach(() => {
    sut = new FakeUseCase();
  });

  it("should be able that the use case returns in the right flow", async () => {
    const input: FakeUseCaseInput = { success: true };
    const { isRight, result } = await sut.execute<"success">({ success: true });

    expect(isRight()).toBeTruthy();
    expect(result).toEqual({ input, ok: true });
  });

  it("should be able that the use case returns in the left flow", async () => {
    const { isLeft, reason } = await sut.execute<"error">({ success: false });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(FakeError);
  });

  describe("Given invalid input", () => {
    it("should be able that the use case returns in the left flow with empty input", async () => {
      // @ts-expect-error: use case require input
      const { isLeft, reason } = await sut.execute<"error">();

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should be able that the use case returns in the left flow with invalid expected field", async () => {
      const { isLeft, reason } = await sut.execute<"error">({
        // @ts-expect-error: expect boolean
        success: faker.lorem.sentence(),
      });

      expect(isLeft()).toBeTruthy();
      expect(reason).toBeInstanceOf(ValidationError);
    });

    it("should be able cause the use case to ignore unexpected fields", async () => {
      const validInput: FakeUseCaseInput = { success: true };
      const { isRight, result } = await sut.execute<"success">({
        ...validInput,
        // @ts-expect-error: unexpected field
        unexpectedField: true,
        unexpectedField2: true,
      });

      expect(isRight()).toBeTruthy();
      expect(result.input).not.toHaveProperty("unexpectedField");
      expect(result.input).not.toHaveProperty("unexpectedField2");
    });
  });
});
