import { Encryption } from "@/domain/gateways/cryptology/encryption";
import { Injectable } from "@nestjs/common";
import { randomBytes } from "crypto";

@Injectable()
export class CryptoEncryption implements Encryption {
  public async encrypt(bytes: number): Promise<string> {
    return randomBytes(bytes).toString("hex");
  }
}
