import { randomUUID } from "node:crypto";

export class UniqueEntityId {
  public constructor(public readonly value: string = randomUUID()) {}
}
