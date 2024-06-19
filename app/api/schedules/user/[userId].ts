import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/lib/models/schedule";
import { Types } from "mongoose";

// @desc    Get all schedules by user ID
// @route   GET /schedules/user/:userId
// @access  Public
export const getSchedulesByUserId = async (context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // check if the user ID is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find({ "employees.employee": userId })
      .populate("employees.employee", "username allUserRoles")
      .lean();

    return !schedules.length
      ? new NextResponse(JSON.stringify({ message: "No schedules found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(schedules), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
