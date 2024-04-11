export type UnrestrictOptional<T, K extends string | number | symbol> = Omit<
  Partial<T>,
  Exclude<keyof T, K>
> &
  Pick<T, Exclude<keyof T, K>>;
