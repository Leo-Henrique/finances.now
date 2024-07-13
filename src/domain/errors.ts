import { DomainError } from "@/core/errors/domain-error";
import { capitalizeFirstWord } from "@/utils/capitalize-text";

type Resources =
  | "usuário"
  | "conta bancária"
  | "cartão de crédito"
  | "categoria de transação"
  | "transação";

export class ResourceAlreadyExistsError extends DomainError {
  public error = "ResourceAlreadyExistsError";
  public HTTPStatusCode = 409;
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} já existente.`);
  }
}

export class ResourceNotFoundError extends DomainError {
  public error = "ResourceNotFoundError";
  public HTTPStatusCode = 400;
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} inexistente.`);
  }
}

export class InvalidCredentialsError extends DomainError {
  public error = "InvalidCredentialsError";
  public HTTPStatusCode = 401;
  public debug = null;

  constructor() {
    super("Credenciais inválidas.");
  }
}

export class UnauthorizedError extends DomainError {
  public error = "UnauthorizedError";
  public HTTPStatusCode = 401;
  public debug = null;

  constructor() {
    super("Não autorizado.");
  }
}

export class NewPasswordSameAsCurrentError extends DomainError {
  public error = "NewPasswordSameAsCurrentError";
  public HTTPStatusCode = 400;
  public debug = null;

  constructor() {
    super("A nova senha deve ser diferente da atual.");
  }
}

export class TransactionAlreadyAccomplishedError extends DomainError {
  public error = "TransactionAlreadyAccomplishedError";
  public HTTPStatusCode = 400;
  public debug = null;

  constructor() {
    super("A transação já foi paga.");
  }
}
