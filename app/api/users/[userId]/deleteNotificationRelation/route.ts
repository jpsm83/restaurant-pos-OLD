import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import User from "@/app/lib/models/user";
import Notification from "@/app/lib/models/notification";

// @desc    Create new users
// @route   PATCH /users/:userId/deleteNotificationRelation
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

    // Pull the notification from the user's notifications array and update the notification
    const [userUpdateResult, notificationUpdateResult] = await Promise.all([
      User.updateOne(
        { _id: userId },
        { $pull: { notifications: { notificationId } } },
        { session }
      ),

      Notification.updateOne(
        { _id: notificationId },
        { $pull: { userRecipientsId: userId } },
        { session }
      ),
    ]);

    // Check if the updates were successful
    if (
      userUpdateResult.modifiedCount === 0 ||
      notificationUpdateResult.modifiedCount === 0
    ) {
      await session.abortTransaction();
      const message =
        userUpdateResult.modifiedCount === 0
          ? "User not found!"
          : "Notification not found!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `User notification relation deleted successfully!`,
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
