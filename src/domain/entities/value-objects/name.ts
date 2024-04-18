import { z } from "zod";

export class Name {
  public constructor(public readonly value: string) {}

  public static get regex() {
    return new RegExp(/^[^\p{Emoji}!@#$%^&*()_+=[\]{};:"<>?|/\\`~]*$/u);
  }

  public static get schema() {
    return z.string().max(255).trim().regex(Name.regex);
  }
}
