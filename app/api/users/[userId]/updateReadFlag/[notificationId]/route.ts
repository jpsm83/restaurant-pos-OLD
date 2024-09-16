import { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import User from "@/app/lib/models/user";

// @desc    Create new users
// @route   PATCH /users/:userId/updateReadFlag/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId; notificationId: Types.ObjectId };
  }
) => {
  // update notification readFlag from user
  try {
    const { userId, notificationId } = context.params;

    // validate userId
    if (isObjectIdValid([userId, notificationId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "User ID is not valid!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // update the readFlag for the user notification
    const updatedUser = await User.findByIdAndUpdate(
      {
        _id: userId,
        "notifications.notificationId": notificationId,
      },
      { $set: { "notifications.$.readFlag": true } },
      { new: true, lean: true }
    );

    // Check if the purchase was found and updated
    if (!updatedUser) {
      return new NextResponse(
        JSON.stringify({ message: "User or notification not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

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
