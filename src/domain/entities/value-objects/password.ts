import { z } from "zod";

export class Password {
  public constructor(public readonly value: string) {}

  public static get schema() {
    return z.string().min(6).max(60);
  }
}
