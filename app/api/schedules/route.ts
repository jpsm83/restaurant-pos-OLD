import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { ISchedule } from "@/app/lib/interface/ISchedule";
import { handleApiError } from "@/app/utils/handleApiError";
import { getWeekNumber } from "./utils/getWeekNumber";
import { addEmployeeToSchedule } from "./utils/addEmployeeToSchedule";
import { Types } from "mongoose";
import { deleteEmployeeFromSchedule } from "./utils/deleteEmployeeFromSchedule";
import { updateEmployeeSchedule } from "./utils/updateEmployeeSchedule";

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
      ? new NextResponse("No schedules found!", {
          status: 404,
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
      return new NextResponse("Date and business are required fields", {
        status: 400,
      });
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
        `Schedule for ${date} already exists for business ${business}`,
        { status: 409 }
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

    return new NextResponse(`Schedule ${newSchedule.date} created!`, {
      status: 201,
    });
  } catch (error) {
    return handleApiError("Create schedule failed!", error);
  }
};

// export const POST = async (req: Request) => {
//   try {
//     const scheduleId = "66771473b2b36aea9e001747";
//     const userId = "66758b8904c4e6f5bbaa6b81";
//     const userScheduleId = "6677f5cb911035d92c5d5ec6";

//     const employeeSchedule = {
//       userId: "66758b8904c4e6f5bbaa6b81",
//       role: "Manager",
//       timeRange: {
//         startTime: "2024-06-15T10:00:00.000Z",
//         endTime: "2024-06-15T11:00:00.000Z",
//       },
//       vacation: false,
//       _id: "6677f5cb911035d92c5d5ec6",
//     };

//     // // @ts-ignore
//     // const addEmploy = await addEmployeeToSchedule(scheduleId, employeeSchedule);
//     // return new NextResponse(JSON.stringify(addEmploy), {
//     //   status: 201, headers: { "Content-Type": "application/json" },
//     // });

//     // // @ts-ignore
//     // const updateEmploy = await updateEmployeeSchedule(scheduleId, employeeSchedule);
//     // return new NextResponse(JSON.stringify(updateEmploy), {
//     //   status: 201, headers: { "Content-Type": "application/json" },
//     // });

//     // @ts-ignore
//     const deleteEmploy = await deleteEmployeeFromSchedule(scheduleId, userId, userScheduleId);
//     return new NextResponse(JSON.stringify(deleteEmploy), {
//       status: 201, headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create schedule failed!", error);
//   }
// };
