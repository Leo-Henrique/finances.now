import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityInstance,
} from "@/core/@types/entity";
import { BaseEntity } from "@/core/entities/base-entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { z } from "zod";

export type Transaction = EntityInstance<TransactionEntity>;

export type TransactionData = EntityData<TransactionEntity>;

export type TransactionDataCreate = EntityDataCreate<TransactionEntity>;

export type TransactionDataUpdate = EntityDataUpdate<TransactionEntity>;

export type TransactionDataUpdated = EntityDataUpdated<TransactionEntity>;

export abstract class TransactionEntity extends BaseEntity {
  defineOriginId() {
    return this.createField({
      schema: z.instanceof(UniqueEntityId).nullable(),
      default: null,
      readonly: true,
    });
  }

  defineTransactedAt() {
    return this.createField({
      schema: z.date(),
      transform: (val: Date) => {
        return new Date(val.getFullYear(), val.getMonth(), val.getDate());
      },
    });
  }

  defineIsAccomplished() {
    return this.createField({
      schema: z.boolean(),
      default: false,
    });
  }

  defineAmount() {
    return this.createField({
      schema: z.number().positive(),
    });
  }

  defineRecurrencePeriod() {
    return this.createField({
      schema: z.enum(["day", "week", "month", "year"]).nullable(),
      default: null,
      readonly: true,
    });
  }

  defineRecurrenceAmount() {
    return this.createField({
      schema: z.number().int().positive().nullable(),
      default: null,
      readonly: true,
      onDefinition: () => {
        const { recurrencePeriod, recurrenceAmount } =
          this.getData<TransactionEntity>();

        if (recurrencePeriod && !recurrenceAmount)
          this.earlyUpdate<TransactionEntity>({ recurrenceAmount: 1 });
      },
    });
  }

  defineRecurrenceLimit() {
    return this.createField({
      schema: z.number().int().positive().nullable(),
      default: null,
      readonly: true,
    });
  }

  defineDescription() {
    return this.createField({
      schema: z.string().max(255).trim(),
    });
  }
}
