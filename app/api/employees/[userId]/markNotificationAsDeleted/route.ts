import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import User from "@/app/lib/models/employee";
import Notification from "@/app/lib/models/notification";

// @desc    Create new users
// @route   PATCH /users/:userId/markNotificationAsDeleted
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  // delete notification relation from user.notifications
  const userId = context.params.userId;

  const { notificationId } = (await req.json()) as {
    notificationId: Types.ObjectId;
  };

  // validate userId
  if (!isObjectIdValid([userId, notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "User or notification ID is not valid!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check notification exists
    const notificationExists = await Notification.exists({
      _id: notificationId,
    });

    if (!notificationExists) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // user can mark notification as deleted but never delete it for data integrity
    const notificationUpdate = await User.updateOne(
      { _id: userId, "notifications.notificationId": notificationId },
      {
        $set: {
          "notifications.$.deletedFlag": true,
          "notifications.$.readFlag": true,
        },
      },
      { session }
    );

    // Check if the updates were successful
    if (notificationUpdate.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(JSON.stringify({ message: "User not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `User notification mark as deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError(
      "Update notification read flag from user failed!",
      error
    );
  } finally {
    session.endSession();
  }
};
