import { DomainError } from "@/core/errors/domain-error";
import { capitalizeFirstWord } from "@/utils/capitalize-first-word";

type Resources =
  | "token de ativação de conta"
  | "sessão"
  | "usuário"
  | "conta bancária"
  | "cartão de crédito"
  | "categoria de transação"
  | "transação";

export class ResourceAlreadyExistsError extends DomainError {
  public error = "ResourceAlreadyExistsError" as const;
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} já existente.`);
  }
}
export class ResourceNotFoundError extends DomainError {
  public error = "ResourceNotFoundError" as const;
  public debug = null;

  constructor(resource: Resources) {
    super(`${capitalizeFirstWord(resource)} inexistente.`);
  }
}

export class InvalidCredentialsError extends DomainError {
  public error = "InvalidCredentialsError" as const;
  public debug = null;

  constructor() {
    super("Credenciais inválidas.");
  }
}

export class FailedToSendEmailForActivationAccountError extends DomainError {
  public error = "FailedToSendEmailForActivationAccountError" as const;

  constructor(public debug: unknown) {
    super(
      `Tentamos enviar um e-mail para você ativar sua conta mas não obtivemos sucesso. Por favor, tente novamente.`,
    );
  }
}

export class AccountActivationTokenExpiredError extends DomainError {
  public error = "AccountActivationTokenExpiredError" as const;
  public debug = null;

  constructor() {
    super(
      `O token de ativação de conta está expirado. Faça login para obter um novo token.`,
    );
  }
}

export class UnauthorizedError extends DomainError {
  public error = "UnauthorizedError" as const;
  public debug = null;

  constructor() {
    super("Não autorizado.");
  }
}

export class ForbiddenActionError extends DomainError {
  public error = "ForbiddenActionError" as const;
  public debug = null;

  constructor(message = "Ação negada.") {
    super(message);
  }
}

export class NewPasswordSameAsCurrentError extends DomainError {
  public error = "NewPasswordSameAsCurrentError" as const;
  public debug = null;

  constructor() {
    super("A nova senha deve ser diferente da atual.");
  }
}

export class TransactionAlreadyAccomplishedError extends DomainError {
  public error = "TransactionAlreadyAccomplishedError" as const;
  public debug = null;

  constructor() {
    super("A transação já foi paga.");
  }
}
