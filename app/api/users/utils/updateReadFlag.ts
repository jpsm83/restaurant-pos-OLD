import connectDB from "@/lib/db";
import Notification from "@/lib/models/notification";
import User from "@/lib/models/user";
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
      return new NextResponse(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found" }),
        { status: 404 }
      );
    }

    // update the readFlag for the user notification
    const updatedUserNotification = await User.findByIdAndUpdate(
      {
        _id: userId,
        "notifications.notification": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } },
      { new: true, usefindAndModify: false }
    ).lean();

    return new NextResponse(
      JSON.stringify({
        message: `Notification ${notificationId} updated successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Failed to update Notification - Error: " + error, {
      status: 500,
    });
  }
};
