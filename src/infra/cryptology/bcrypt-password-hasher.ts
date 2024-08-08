import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
import { Injectable } from "@nestjs/common";
import { compare, hash } from "bcryptjs";

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  public async hash(password: string): Promise<string> {
    return hash(password, 12);
  }

  public async match(password: string, hash: string): Promise<boolean> {
    return compare(password, hash);
  }
}
