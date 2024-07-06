export function millisecondsRemainingForDate(targetDate: Date) {
  const currentDate = new Date();

  return targetDate.getTime() - currentDate.getTime();
}
