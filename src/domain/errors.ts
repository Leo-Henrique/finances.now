import { DomainError } from "@/core/errors/domain-error";
import { capitalizeFirstWord } from "@/utils/capitalize-first-word";

type Resources =
  | "usuário"
  | "conta bancária"
  | "cartão de crédito"
  | "categoria de transação"
  | "transação";

export class ResourceAlreadyExistsError extends DomainError {
  public error = "ResourceAlreadyExistsError";
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} já existente.`);
  }
}

export class ResourceNotFoundError extends DomainError {
  public error = "ResourceNotFoundError";
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} inexistente.`);
  }
}

export class InvalidCredentialsError extends DomainError {
  public error = "InvalidCredentialsError";
  public debug = null;

  constructor() {
    super("Credenciais inválidas.");
  }
}

export class UnauthorizedError extends DomainError {
  public error = "UnauthorizedError";
  public debug = null;

  constructor() {
    super("Não autorizado.");
  }
}

export class ForbiddenActionError extends DomainError {
  public error = "ForbiddenActionError";
  public debug = null;

  constructor() {
    super("Ação negada.");
  }
}

export class NewPasswordSameAsCurrentError extends DomainError {
  public error = "NewPasswordSameAsCurrentError";
  public debug = null;

  constructor() {
    super("A nova senha deve ser diferente da atual.");
  }
}

export class TransactionAlreadyAccomplishedError extends DomainError {
  public error = "TransactionAlreadyAccomplishedError";
  public debug = null;

  constructor() {
    super("A transação já foi paga.");
  }
}
