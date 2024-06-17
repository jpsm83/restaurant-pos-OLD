import Notification from "@/lib/models/notification";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// helper function used on user controller
// keep each controller with its own helper functions
// priciple of separation of concerns
// Remove the user from the recipient array of the notification
export const removeUserFromNotification = async (
    userId: Types.ObjectId,
    notificationId: Types.ObjectId
  ) => {
    // check if the userId is valid
    if (!Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID" }), {
        status: 400,
      });
    }
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }
  
    const updatedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { $pull: { recipient: userId } },
      { new: true, useFindAndModify: false }
    ).lean();
  
    return !updatedNotification ? "Notification could not be updated" : true;
  };
  