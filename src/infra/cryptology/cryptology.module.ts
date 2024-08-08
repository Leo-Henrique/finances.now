import { Encryption } from "@/domain/gateways/cryptology/encryption";
import { PasswordHasher } from "@/domain/gateways/cryptology/password-hasher";
import { Module, Provider } from "@nestjs/common";
import { BcryptPasswordHasher } from "./bcrypt-password-hasher";
import { CryptoEncryption } from "./crypto-encryption";

const gatewaysProviders = [
  {
    provide: PasswordHasher,
    useClass: BcryptPasswordHasher,
  },
  {
    provide: Encryption,
    useClass: CryptoEncryption,
  },
] satisfies Provider[];

@Module({
  providers: gatewaysProviders,
  exports: gatewaysProviders.map(({ provide }) => provide),
})
export class CryptologyModule {}
