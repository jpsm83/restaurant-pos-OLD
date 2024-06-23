import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";

// helper function used on user controller
// keep each controller with its own helper functions
// priciple of separation of concerns
// Remove the user from the recipient array of the notification
export const removeUserFromNotification = async (
  userId: Types.ObjectId,
  notificationId: Types.ObjectId
) => {
  try {
    // check if the userId is valid
    if (!Types.ObjectId.isValid(userId)) {
      return "Invalid user ID!";
    }
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return "Invalid notification ID!";
    }

    const updatedNotification = await Notification.updateOne(
      { _id: notificationId },
      { $pull: { recipients: userId } }
    );

    const updatedUser = await User.updateOne(
      { _id: userId },
      { $pull: { notifications: { notification: notificationId } } }
    );

    if (updatedNotification.modifiedCount === 0) {
      return "Notification recipients could not be updated!";
    }

    if (updatedUser.modifiedCount === 0) {
      return "User notifications could not be updated!";
    }

    return true;
  } catch (error) {
    return "Remove user from notification and vice versa failed!";
  }
};
