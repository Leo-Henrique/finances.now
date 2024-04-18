import { compareSync, hashSync } from "bcryptjs";
import { z } from "zod";

export class PasswordHash {
  public readonly hash: string;

  public constructor(password: string) {
    this.hash = hashSync(password, 6);
  }

  public static get schema() {
    return z.string().min(6).max(60);
  }

  public match(password: string) {
    return compareSync(password, this.hash);
  }
}
