import { NextResponse } from "next/server";
import { removeUserFromNotification } from "../../notifications/utils/removeUserFromNotification";
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// remove notification from user
export const deleteUserFromNotification = async (
  userId: Types.ObjectId,
  notificationId: Types.ObjectId
) => {
  try {
    // connect before first call to DB
    await connectDB();

    // check if user exists
    const user = await User.findById(userId).lean();
    if (!user) {
      return new NextResponse(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId).lean();
    if (!notification) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        { status: 404 }
      );
    }

    // remove the notification from the user
    // this function is in the notificationsController
    // keep each controller with its own functions
    // priciple of separation of concerns
    const removeUserFromNotificationResult = await removeUserFromNotification(
      userId,
      notificationId
    );

    if (removeUserFromNotificationResult !== true) {
      return new NextResponse(
        JSON.stringify({ message: removeUserFromNotificationResult }),
        { status: 400 }
      );
    } else {
      return new NextResponse(
        JSON.stringify({
          message: `User id ${userId} removed from notification successfully!`,
        }),
        { status: 200 }
      );
    }
  } catch (error: any) {
    return new NextResponse(
      "Remove notification from user failed - Error: " + error,
      { status: 500 }
    );
  }
};
