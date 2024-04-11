import { faker } from "@faker-js/faker";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { Either, left, right } from "./either";
import { DomainError } from "./errors/domain-error";
import { ValidationError } from "./errors/errors";
import { UseCase } from "./use-case";

class FakeError extends DomainError {
  public error = "FakeError";
  public HTTPStatusCode = 500;
  public debug = null;

  constructor() {
    super("Fake error.");
  }
}

const fakeUseCaseSchema = z.object({ success: z.boolean() });

type FakeUseCaseInput = z.infer<typeof fakeUseCaseSchema>;

type FakeUseCaseOutput = Either<FakeError, { ok: true }>;

export class FakeUseCase extends UseCase<FakeUseCaseInput, FakeUseCaseOutput> {
  public constructor() {
    super({ inputSchema: fakeUseCaseSchema });
  }

  protected async handle({ success }: FakeUseCaseInput) {
    if (!success) return left(new FakeError());

    return right({ ok: true } as const);
  }
}

let sut: FakeUseCase;

describe("[Core] Use Case", () => {
  beforeEach(() => {
    sut = new FakeUseCase();
  });

  it("should be able that the use case returns in the right flow", async () => {
    const { isRight, result } = await sut.execute<"success">({ success: true });

    expect(isRight()).toBeTruthy();
    expect(result).toEqual({ ok: true });
  });

  it("should be able that the use case returns in the left flow", async () => {
    const { isLeft, reason } = await sut.execute<"error">({ success: false });

    expect(isLeft()).toBeTruthy();
    expect(reason).toBeInstanceOf(FakeError);
  });

  it("should be able that the use case returns in the left flow with the invalid input", async () => {
    // @ts-expect-error: use case require input
    const emptyInputResult = await sut.execute<"error">();

    expect(emptyInputResult.isLeft()).toBeTruthy();
    expect(emptyInputResult.reason).toBeInstanceOf(ValidationError);

    const invalidInputResult = await sut.execute<"error">({
      // @ts-expect-error: expect boolean
      success: faker.lorem.sentence(),
    });

    expect(invalidInputResult.isLeft()).toBeTruthy();
    expect(invalidInputResult.reason).toBeInstanceOf(ValidationError);
  });
});
