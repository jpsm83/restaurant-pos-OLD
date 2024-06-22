import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Schedule from "@/app/lib/models/schedule";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get all schedules by business ID
// @route   GET /schedules/business/:businessId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;
    // check if the business ID is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse("Invalid business ID!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const schedules = await Schedule.find({ business: businessId })
      // .populate("employees.employee", "username allUserRoles")
      .lean();

    return !schedules.length
      ? new NextResponse("No schedules found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(schedules), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get schedule by business id failed!", error);
  }
};
