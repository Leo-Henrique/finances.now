export abstract class Encryption {
  abstract encrypt(bytes: number): Promise<string>;
}
