import { NextResponse } from "next/server";

export const validateDaysOfTheWeek = (weekDays: string[], obj: any) => {
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
        return new NextResponse(JSON.stringify({ message: `Invalid day(s) in the weekDays array.` }), { status: 400 });
      }
      obj.weekDays = weekDays;
      return true;
    } else {
      return "Invalid weekDays!";
    }
  };
    