import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/app/lib/models/notification";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get all notifications by business ID
// @route   GET /notifications/business/:businessId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse("Invalid business ID!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const notifications = await Notification.find({ business: businessId })
      .populate("recipients", "username")
      .lean();

    return !notifications.length
      ? new NextResponse("No notifications found!", { status: 404 })
      : new NextResponse(JSON.stringify(notifications), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get notifications by business id failed!", error);
  }
};
