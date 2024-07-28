import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { ISchedule } from "@/app/lib/interface/ISchedule";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { getWeekNumber } from "./utils/getWeekNumber";

// @desc    Get all schedules
// @route   GET /schedules
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find()
      // .populate("employees.userId", "username allUserRoles")
      .lean();

    return !schedules.length
      ? new NextResponse(JSON.stringify({ message: "No schedules found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(schedules), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all schedules failed!", error);
  }
};

// we create an empty schedule object to be used in the POST method
// it will be populated with employee data using addEmployeeToSchedule
// @desc    Create a new schedule
// @route   POST /schedules
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { date, business, comments } = (await req.json()) as ISchedule;

    // check required fields
    if (!date || !business) {
      return new NextResponse(
        JSON.stringify({ message: "Date and business are required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // get the week number
    // ***** THIS NUMBER IS THE YEAR FOLLOW BY THE WEEK NUMBER *****
    // ***** EXAMPLE: 202421 *****
    // This function calculates the week number of the year starting on Monday, following the ISO 8601 standard
    const weekNumber = getWeekNumber(new Date(date));

    // connect before first call to DB
    await connectDB();

    // check if schedule already exists
    const duplicateSchedule = await Schedule.findOne({ date, business });

    if (duplicateSchedule) {
      return new NextResponse(
        JSON.stringify({
          message: `Schedule for ${date} already exists for business ${business}`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create schedule object
    const newSchedule = {
      date,
      weekNumber: weekNumber,
      business,
      comments: comments || undefined,
    };

    // create new schedule
    await Schedule.create(newSchedule);

    return new NextResponse(
      JSON.stringify({ message: `Schedule ${newSchedule.date} created!` }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create schedule failed!", error);
  }
};
