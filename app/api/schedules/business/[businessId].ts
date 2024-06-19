import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { Types } from "mongoose";

// @desc    Get all schedules by business ID
// @route   GET /schedules/business/:businessId
// @access  Public
export const getSchedulesByBusinessId = async (context: { params: any }) => {
  try {
    const businessId = context.params.businessId;
    // check if the business ID is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find({ business: businessId })
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
