import {
  CreateJobOptions,
  JobSchedulingService,
  Work,
  WorkWithDynamicDate,
} from "@/domain/services/job-scheduling.service";
import { randomUUID } from "crypto";

interface Job {
  id: string;
  key: string | null;
}

export class InMemoryJobSchedulingService implements JobSchedulingService {
  public items: Job[] = [];

  private create(options: CreateJobOptions = {}) {
    const job: Job = { id: randomUUID(), key: null, ...options };

    this.items.push(job);

    return job;
  }

  private delete(jobId: string) {
    const jobIndex = this.items.findIndex(item => jobId === item.id);

    if (jobIndex < 0) return;

    this.items.splice(jobIndex, 1);
  }

  private longTimeout(callback: () => void, duration: number): NodeJS.Timeout {
    const maxDuration = 2147483647;

    if (duration > maxDuration) {
      return setTimeout(
        () => this.longTimeout(callback, duration - maxDuration),
        maxDuration,
      );
    }

    return setTimeout(callback, duration);
  }

  public async createUnique(work: Work, date: Date, options: CreateJobOptions) {
    const job = this.create(options);

    const millisecondsToRun = date.getTime() - new Date().getTime();

    setTimeout(async () => {
      await work();
      this.delete(job.id);
    }, millisecondsToRun);
  }

  // TODO: for carrying out automatic transactions
  // public async createRepeatableByPeriod(
  //   work: Work,
  //   {
  //     period,
  //     fromDate,
  //     amount,
  //     limit,
  //     ...createJobOptions
  //   }: CreateRepeatableByPeriodOptions,
  // ) {
  //   const periods = ["day", "week", "month", "year"];

  //   if (!periods.includes(period))
  //     throw new Error("Invalid period for repeatable scheduling.");

  //   const job = this.create(createJobOptions);

  //   const millisecondsToPrevail = fromDate.getTime() - new Date().getTime();
  //   const getMillisecondsToNextWork = () => {
  //     const now = new Date();
  //     let [year, month, day] = [
  //       now.getFullYear(),
  //       now.getMonth(),
  //       now.getDate(),
  //     ];

  //     if (period === "day") day += amount ?? 1;

  //     if (period === "week") day += amount ?? 7;

  //     if (period === "month") month += amount ?? 1;

  //     if (period === "year") year += amount ?? 1;

  //     const nextDate = new Date(year, month, day);

  //     return nextDate.getTime() - now.getTime();
  //   };

  //   const schedule = (recurrence = 1) => {
  //     this.longTimeout(async () => {
  //       await work();

  //       if (limit) {
  //         if (recurrence < limit) return schedule(recurrence + 1);

  //         this.delete(job.id);
  //       } else {
  //         schedule(recurrence + 1);
  //       }
  //     }, getMillisecondsToNextWork());
  //   };

  //   this.longTimeout(schedule, millisecondsToPrevail);
  // }

  public async createRepeatableByDynamicDate(
    work: WorkWithDynamicDate,
    firstDate: Date,
    options: CreateJobOptions,
  ) {
    const job = this.create(options);

    const millisecondsToInit = firstDate.getTime() - new Date().getTime();
    const schedule = (time = millisecondsToInit) => {
      this.longTimeout(async () => {
        const nextDate = await work();

        if (nextDate) {
          schedule(nextDate.getTime() - new Date().getTime());
          return;
        }

        this.delete(job.id);
      }, time);
    };

    schedule();
  }

  public async deleteManyByKey(key: string) {
    const jobIndex = this.items.findIndex(job => job.key === key);

    if (jobIndex > -1) {
      this.delete(this.items[jobIndex].id);
      this.deleteManyByKey(key);
    }
  }
}
