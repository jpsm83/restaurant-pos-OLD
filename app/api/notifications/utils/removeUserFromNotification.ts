import Notification from "@/app/lib/models/notification";
import { handleApiError } from "@/app/utils/handleApiError";
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
      { $pull: { recipient: userId } }
    );

    if (updatedNotification.modifiedCount === 0) {
      return "Notification could not be updated!";
    }

    return true;
    
  } catch (error) {
    return handleApiError("Remove user from notification failed!", error);
  }
};