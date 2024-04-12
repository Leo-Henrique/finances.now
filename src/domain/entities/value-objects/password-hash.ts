import { compareSync, hashSync } from "bcryptjs";

export class PasswordHash {
  public readonly hash: string;

  public constructor(password: string) {
    this.hash = hashSync(password, 6);
  }

  public match(password: string) {
    return compareSync(password, this.hash);
  }
}
