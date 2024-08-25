import connectDB from "@/app/lib/db";
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Create new users
// @route   POST /users/:userId/updateReadFlag
// @access  Private
export const POST = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  // update notification readFlag from user
  try {
    const { notificationId } = (await req.json()) as {
      notificationId: Types.ObjectId;
    };

    const userId = context.params.userId;

    // connect before first call to DB
    await connectDB();

    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // update the readFlag for the user notification
    await User.updateOne(
      {
        _id: userId,
        "notifications.notification": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } }
    );

    return new NextResponse(
      JSON.stringify({
        message: `Notification ${notificationId} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError(
      "Update notification read flag from user failed!",
      error
    );
  }
};
