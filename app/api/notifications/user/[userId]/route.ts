import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";

// @desc    Get all notifications by user ID
// @route   GET /notifications/user/:userId
// @access  Public
export const GET = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  const userId = context.params.userId;

  if (!isObjectIdValid([userId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid business ID!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find({
      userRecipientsId: userId,
    })
      .populate({
        path: "userRecipientsId",
        select: "username",
        model: User,
      })
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
    return handleApiError("Get users by business id failed!", error);
  }
};
