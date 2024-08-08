import { Encryption } from "@/domain/gateways/cryptology/encryption";
import { faker } from "@faker-js/faker";

export class FakeEncryption implements Encryption {
  public async encrypt(bytes: number) {
    return faker.string.alphanumeric(bytes * 2);
  }
}
