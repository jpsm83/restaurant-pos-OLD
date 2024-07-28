import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";

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
    // check if the user ID is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find({ "employees.userId": userId })
      // .populate("employees.employee", "username allUserRoles")
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
