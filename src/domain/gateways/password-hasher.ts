export interface PasswordHasher {
  hash(password: string): Promise<string>;
  match(password: string, hash: string): Promise<boolean>;
}
