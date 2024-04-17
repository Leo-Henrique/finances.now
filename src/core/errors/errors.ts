import { DomainError } from "./domain-error";

export class ValidationError extends DomainError {
  public error = "ValidationError";
  public HTTPStatusCode = 400;
  public debug: object | null;

  constructor(debug?: object) {
    super("Os dados recebidos são inválidos.");

    this.debug = debug ?? null;
  }
}
