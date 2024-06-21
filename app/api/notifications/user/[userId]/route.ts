import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

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
      return new NextResponse("Invalid business ID!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const notifications = await Notification.find({
      recipients: { $in: userId },
    });
    
    return !notifications.length
      ? new NextResponse("No notifications found!", { status: 404 })
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
