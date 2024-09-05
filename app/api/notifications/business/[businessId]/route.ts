import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/app/lib/models/notification";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";

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
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find({ business: businessId })
      .populate("recipients", "username")
      .lean();

    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
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
