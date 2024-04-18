import { randomUUID } from "node:crypto";
import { z } from "zod";

export class UniqueEntityId {
  public constructor(public readonly value: string = randomUUID()) {}

  public static get schema() {
    return z.string().uuid();
  }
}
