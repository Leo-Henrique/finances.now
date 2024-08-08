export abstract class PasswordHasher {
  abstract hash(password: string): Promise<string>;
  abstract match(password: string, hash: string): Promise<boolean>;
}
