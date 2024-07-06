export type Work = () => Promise<void>;

export type WorkWithDynamicDate = () => Promise<Date | null>;

export interface CreateJobOptions {
  id?: string;
  key?: string;
}

export interface CreateRepeatableByPeriodOptions extends CreateJobOptions {
  period: "day" | "week" | "month" | "year";
  fromDate: Date;
  amount?: number;
  limit?: number;
}

export interface JobSchedulingService {
  createUnique(
    work: Work,
    date: Date,
    options?: CreateJobOptions,
  ): Promise<void>;
  // TODO: for carrying out automatic transactions
  // createRepeatableByPeriod(
  //   work: Work,
  //   options: CreateRepeatableByPeriodOptions,
  // ): Promise<void>;
  createRepeatableByDynamicDate(
    work: WorkWithDynamicDate,
    firstDate: Date,
    options?: CreateJobOptions,
  ): Promise<void>;
  deleteManyByKey(key: string): Promise<void>;
}
