import { EntityDefinition, EntityInstance } from "@/core/@types/entity";
import { BaseEntity } from "@/core/entities/base-entity";
import { UniqueEntityId } from "@/core/entities/unique-entity-id";
import { z } from "zod";

export type Transaction = EntityInstance<TransactionEntity>;

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
