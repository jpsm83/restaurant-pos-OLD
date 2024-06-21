export const convertToShiftHours = (startTime: Date, endTime: Date) => {
  // Calculate difference in milliseconds
  const difference = endTime.getTime() - startTime.getTime();

  // Convert milliseconds to hours, minutes, and seconds
  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference / (1000 * 60)) % 60);
  const seconds = Math.floor((difference / 1000) % 60);

  // Format the time difference into a string "hh-mm-ss"
  const shiftHours = [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join("-");

  return shiftHours;
};
