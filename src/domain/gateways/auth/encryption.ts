export interface Encryption {
  encrypt(bytes: number): Promise<string>;
}
