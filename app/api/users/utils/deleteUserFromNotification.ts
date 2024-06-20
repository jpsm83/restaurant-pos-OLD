import { NextResponse } from "next/server";
import { removeUserFromNotification } from "../../notifications/utils/removeUserFromNotification";
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

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
      return new NextResponse("User not found", {
        status: 404,
      });
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId).lean();
    if (!notification) {
      return new NextResponse("Notification not found!", { status: 404 });
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
      return new NextResponse(removeUserFromNotificationResult as string, {
        status: 400,
      });
    } else {
      return new NextResponse(
        `User id ${userId} removed from notification successfully!`,
        { status: 200 }
      );
    }
  } catch (error) {
    return handleApiError("Get user from notifications failed!", error);
  }
};
