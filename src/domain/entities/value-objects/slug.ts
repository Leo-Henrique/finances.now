import { z } from "zod";

export class Slug {
  public readonly value: string;

  public constructor(text: string) {
    const slugText = text
      .normalize("NFKD")
      .replace(/[^\w\s]+|_+/g, "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-");

    this.value = slugText;
  }

  public static get schema() {
    return z.string();
  }
}
