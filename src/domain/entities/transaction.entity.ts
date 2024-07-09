import {
  EntityData,
  EntityDataCreate,
  EntityDataUpdate,
  EntityDataUpdated,
  EntityDefinition,
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

export abstract class TransactionEntity
  extends BaseEntity
  implements EntityDefinition<TransactionEntity>
{
  defineOriginId() {
    return {
      schema: z.instanceof(UniqueEntityId).nullable(),
      default: null,
      readonly: true,
    };
  }

  defineTransactedAt() {
    return {
      schema: z.date(),
      transform: (val: Date) => {
        return new Date(val.getFullYear(), val.getMonth(), val.getDate());
      },
    };
  }

  defineIsAccomplished() {
    return {
      schema: z.boolean(),
      default: false,
    };
  }

  defineAmount() {
    return {
      schema: z.number().positive(),
    };
  }

  defineRecurrencePeriod() {
    return {
      schema: z.enum(["day", "week", "month", "year"]).nullable(),
      default: null,
    };
  }

  defineRecurrenceAmount() {
    return {
      schema: z.number().int().positive().nullable(),
      default: null,
      onDefinition: () => {
        const { recurrencePeriod, recurrenceAmount } =
          this.getData<TransactionEntity>();

        if (recurrencePeriod && !recurrenceAmount)
          this.earlyUpdate<TransactionEntity>({ recurrenceAmount: 1 });
      },
    };
  }

  defineRecurrenceLimit() {
    return {
      schema: z.number().int().positive().nullable(),
      default: null,
    };
  }

  defineDescription() {
    return {
      schema: z.string().max(255).trim(),
    };
  }
}
