import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/app/lib/models/notification";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get all notifications by user ID
// @route   GET /notifications/user/:userId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  try {
    const userId = context.params.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const notifications = await Notification.find({
      recipients: { $in: userId },
    });

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
    return handleApiError("Get users by business id failed!", error);
  }
};
