import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import Schedule from "@/app/lib/models/schedule";
import User from "@/app/lib/models/employee";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Get all schedules by user ID
// @route   GET /schedules/user/:userId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  try {
    const userId = context.params.userId;

    // check if the schedule ID is valid
    if (isObjectIdValid([userId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid user Id!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const schedules = await Schedule.find({
      "employeesSchedules.userId": userId,
    })
      .populate({
        path: "employeesSchedules.userId",
        select: "username allUserRoles",
        model: User,
      })
      .lean();

    return !schedules.length
      ? new NextResponse(JSON.stringify({ message: "No schedules found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(schedules), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get schedule by user id failed!", error);
  }
};
