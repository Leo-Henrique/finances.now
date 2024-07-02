export function millisecondsRemainingForDateByPeriod(
  increment: number,
  period: "day" | "week" | "month" | "year",
) {
  const currentDate = new Date();

  let [year, month, day] = [
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  ];

  if (period === "day") day += increment;

  if (period === "week") day += 7 * increment;

  if (period === "month") month += increment;

  if (period === "year") year += increment;

  const targetDate = new Date(year, month, day);

  return targetDate.getTime() - currentDate.getTime();
}
