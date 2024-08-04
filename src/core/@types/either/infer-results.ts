import { Left, Right } from "@/core/either";

export type InferLeft<Either> = Either extends Left<infer L> ? Left<L> : never;

export type InferLeftReason<Either> = Either extends Left<infer L> ? L : never;

export type InferRight<Either> =
  Either extends Right<infer R> ? Right<R> : never;

export type InferRightResult<Either> =
  Either extends Right<infer L> ? L : never;

export type ExpectedResultOfEither = "unknown" | "success" | "error";

export type InferEither<
  Either,
  Expected extends ExpectedResultOfEither,
> = Expected extends "unknown"
  ? Either
  : Expected extends "success"
    ? InferRight<Either>
    : InferLeft<Either>;
