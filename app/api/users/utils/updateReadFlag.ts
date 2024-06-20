import connectDB from "@/app/lib/db";
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// update notification readFlag from user
export const updateReadFlag = async (
  userId: Types.ObjectId,
  notificationId: Types.ObjectId
) => {
  try {
    // connect before first call to DB
    await connectDB();

    // check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return new NextResponse("User not found!", {
        status: 404,
      });
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return new NextResponse("Notification not found!", { status: 404 });
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
      `Notification ${notificationId} updated successfully!`,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(
      "Update notification read flag from user failed!",
      error
    );
  }
};
