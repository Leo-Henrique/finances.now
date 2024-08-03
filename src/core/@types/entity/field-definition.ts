import { z } from "zod";

export interface FieldDefinition<Input = unknown, Output = Input> {
  schema: z.ZodType<Input>;
  default?: Input;
  transform?: (value: Input) => Output;
  static?: boolean;
  readonly?: boolean;
  onDefinition?: () => void;
}

export type ExtractFieldDefinitionInput<T extends FieldDefinition> = z.infer<
  T["schema"]
>;

export type ExtractFieldDefinitionOutput<T extends FieldDefinition> =
  T["transform"] extends Function // eslint-disable-line
    ? ReturnType<T["transform"]>
    : z.infer<T["schema"]>;
