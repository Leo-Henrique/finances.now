import { DomainError } from "./errors/domain-error";

export type EitherReason = DomainError | null;

export type EitherResult = object | null;

export type Either<Reason extends EitherReason, Result extends EitherResult> =
  | Left<Reason>
  | Right<Result>;

export class Left<Reason> {
  constructor(public readonly reason: Reason) {}

  isLeft(): this is Left<Reason> {
    return true;
  }

  isRight(): this is Right<never> {
    return false;
  }
}

export class Right<Result> {
  constructor(public readonly result: Result) {}

  isLeft(): this is Left<never> {
    return false;
  }

  isRight(): this is Right<Result> {
    return true;
  }
}

export const left = <Reason extends EitherReason>(
  reason: Reason,
): Left<Reason> => {
  return new Left<Reason>(reason);
};

export const right = <Result extends EitherResult>(
  result: Result,
): Right<Result> => {
  return new Right<Result>(result);
};
