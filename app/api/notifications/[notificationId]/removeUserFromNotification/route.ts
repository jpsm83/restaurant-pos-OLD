import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Create new notifications
// @route   POST /notifications/:notificationId/removeUserFromNotification
// @access  Private
export const POST = async (req: Request, context: { params: { notificationId: Types.ObjectId } }) => {
  // keep each controller with its own helper functions
  // priciple of separation of concerns
  // Remove the user from the recipient array of the notification
  try {
    const { userId } = (await req.json()) as {
      userId: Types.ObjectId;
    };
    
    const notificationId = context.params.notificationId;

    // check if the userId is valid
    if (!Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid user ID!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
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
      return new NextResponse(
        JSON.stringify({
          message: "Notification recipients could not be updated!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (updatedUser.modifiedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "User notifications could not be updated!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    return handleApiError(
      "Remove user from notification and vice versa failed!",
      error
    );
  }
};
