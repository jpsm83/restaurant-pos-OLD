export const validateDaysOfTheWeek = (weekDays: string[]) => {
  if (!Array.isArray(weekDays) || !weekDays)
    return "WeekDaysis required and must be an array!";

  const daysOfTheWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // validate weekDays
  if (weekDays.length > 0) {
    const allValid = weekDays.every((day) => daysOfTheWeek.includes(day));

    if (!allValid) {
      return `Invalid day(s) in the weekDays array!`;
    }
  }
  return true;
};
