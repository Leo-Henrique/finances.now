import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";

const FAKE_HASHED_PASSWORD_SUFFIX = "_HASHED";

export class FakePasswordHasher implements PasswordHasher {
  public async hash(password: string) {
    return password + FAKE_HASHED_PASSWORD_SUFFIX;
  }

  public async match(password: string, hash: string) {
    return password + FAKE_HASHED_PASSWORD_SUFFIX === hash;
  }
}
