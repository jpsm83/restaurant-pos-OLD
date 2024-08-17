import { handleApiError } from "@/app/lib/utils/handleApiError";
import { NextResponse } from "next/server";

// @desc    Create new schedules
// @route   POST /schedules/actions
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { startTime, endTime } = (await req.json()) as {
      startTime: Date;
      endTime: Date;
    };

    // start time and end time are required
    if (!startTime || !endTime) {
      return new NextResponse(
        JSON.stringify({ message: "Start time and end time are required!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // start time have to be smaller than end time
    if (startTime >= endTime) {
      return new NextResponse(
        JSON.stringify({
          message: "Start time must be smaller than end time!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
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
  } catch (error) {
    return handleApiError("Convert to shift hours failed!", error);
  }
};
