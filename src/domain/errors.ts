import { DomainError } from "@/core/errors/domain-error";
import { toPascalCase } from "@/utils/toPascalCase";

type Resources = "usuário" | "conta bancária" | "cartão de crédito";

export class ResourceAlreadyExistsError extends DomainError {
  public error = "ResourceAlreadyExistsError";
  public HTTPStatusCode = 409;
  public debug = null;

  constructor(resource: Resources) {
    super(`${toPascalCase(resource)} já existente.`);
  }
}

export class ResourceNotFoundError extends DomainError {
  public error = "ResourceNotFoundError";
  public HTTPStatusCode = 400;
  public debug = null;

  constructor(resource: Resources) {
    super(`${toPascalCase(resource)} inexistente.`);
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
