import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/lib/models/notification";
import User from "@/lib/models/user";
import { Types } from "mongoose";

// @desc    Get all notifications by user ID
// @route   GET /notifications/user/:userId
// @access  Public
export const GET = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const userId = context.params.userId;
    // check if the userId is valid
    if (!Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }

    const notifications = await Notification.find({
      recipient: { $in: userId },
    });
    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(notifications), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
