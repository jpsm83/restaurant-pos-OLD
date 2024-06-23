import connectDB from "@/app/lib/db";
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";

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
      return "User not found!";
    }

    // check if notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return "Notification not found!";
    }

    // update the readFlag for the user notification
    await User.updateOne(
      {
        _id: userId,
        "notifications.notification": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } }
    );

    return `Notification ${notificationId} updated successfully!`;
  } catch (error) {
    return "Update notification read flag from user failed!";
  }
};
