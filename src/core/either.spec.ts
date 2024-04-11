import { describe, expect, it } from "vitest";
import {
  Either,
  ExtractError,
  ExtractSuccess,
  Left,
  Right,
  left,
  right,
} from "./either";
import { DomainError } from "./errors/domain-error";

class FakeError extends DomainError {
  public HTTPStatusCode = 0;
  public error = "FakeError";
  public debug = null;

  constructor() {
    super("Fake error.");
  }
}

type DoSomethingResponse = Either<FakeError, Record<string, string>>;

function doSomething(success: boolean): DoSomethingResponse {
  return !success ? left(new FakeError()) : right({});
}

describe("[Core] Either", () => {
  it("should be able to return error on left flow", () => {
    const result = doSomething(false) as ExtractError<DoSomethingResponse>;

    expect(result).toBeInstanceOf(Left);
    expect(result.isLeft()).toBeTruthy();

    if (result.isLeft()) expect(result.reason).instanceOf(FakeError);
  });

  it("should be able to return success on right flow", () => {
    const result = doSomething(true) as ExtractSuccess<DoSomethingResponse>;

    expect(result).toBeInstanceOf(Right);
    expect(result.isRight()).toBeTruthy();
    expect(result.result).toEqual({});
  });
});
