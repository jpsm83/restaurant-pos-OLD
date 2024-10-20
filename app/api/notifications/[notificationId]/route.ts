import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";

// @desc    Get notification by ID
// @route   GET /notifications/:notificationId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  // check if the notificationId is valid
  if (!isObjectIdValid([notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid notification ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    const notification = await Notification.findById(notificationId)
      .populate({
        path: "userRecipientsId",
        select: "username",
        model: User,
      })
      .lean();

    return !notification
      ? new NextResponse(
          JSON.stringify({ message: "Notification not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(notification), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get notification by its id failed!", error);
  }
};

// @desc    Update a notification
// @route   PATCH /notifications/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  const { notificationType, message, userRecipientsId, userSenderId } =
    (await req.json()) as INotification;

  // validate userRecipientsId
  if (!Array.isArray(userRecipientsId) || userRecipientsId.length === 0) {
    return new NextResponse(
      JSON.stringify({
        message: "Recipients must be an array of user IDs!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validation ids
  const usersIds = [...userRecipientsId];
  if (userSenderId) {
    usersIds.push(userSenderId);
  }

  if (!isObjectIdValid([...usersIds, notificationId])) {
    return new NextResponse(
      JSON.stringify({
        message: "Invalid array of IDs!",
      }),
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
    // check all users exist and get notification object
    const [users, notification] = await Promise.all([
      // "exists" will return true if at least one document exists, so we need to use "find" instead
      User.find({ _id: { $in: usersIds } }, null, { lean: true }), // Fetch users in a single query
      Notification.findById(notificationId)
        .select("userRecipientsId message")
        .lean()
        .session(session) as Promise<INotification | null>,
    ]);

    if (users.length !== usersIds.length || !notification) {
      await session.abortTransaction();
      const message =
        users.length !== usersIds.length
          ? "One or more users do not exist!"
          : "Notification not found";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the userRecipientsId that were added
    const addedRecipients = userRecipientsId.filter(
      (userId) =>
        !notification.userRecipientsId.toString().includes(userId.toString())
    );

    // Find the userRecipientsId that were removed
    const removedRecipients = notification.userRecipientsId.filter(
      (userId: Types.ObjectId) =>
        !userRecipientsId.toString().includes(userId.toString())
    );

    // Find the userRecipientsId that were not changed
    const unchangedRecipients = userRecipientsId.filter((userId) =>
      notification.userRecipientsId.toString().includes(userId.toString())
    );

    // prepare the update object
    const updateNotification: Partial<INotification> = {};

    if (notificationType)
      updateNotification.notificationType = notificationType;
    if (message) updateNotification.message = message;
    if (userRecipientsId)
      updateNotification.userRecipientsId = userRecipientsId;
    if (userSenderId) updateNotification.userSenderId = userSenderId;

    // handle all the user updates at once
    const [
      updatedNotification,
      userNotficationAdded,
      userNotificationRemoved,
      userFlagUpdated,
    ] = await Promise.all([
      // update notification
      Notification.updateOne(
        { _id: notificationId },
        { $set: updateNotification },
        {
          session,
        }
      ),

      // Add notification to new users' notifications array
      addedRecipients.length > 0
        ? User.updateMany(
            { _id: { $in: addedRecipients } },
            { $push: { notifications: { notificationId, readFlag: false } } }, // Set readFlag to false for new users
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added

      // Remove notification from old users' notifications array
      removedRecipients.length > 0
        ? User.updateMany(
            { _id: { $in: removedRecipients } },
            { $pull: { notifications: { notificationId } } },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added

      // update the readFlag for each unchangedRecipients
      unchangedRecipients.length > 0 && notification.message !== message
        ? User.updateMany(
            {
              _id: { $in: userRecipientsId },
              "notifications.notificationId": notificationId,
            },
            { $set: { "notifications.$.readFlag": false } },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added
    ]);

    if (
      !updatedNotification ||
      !userNotficationAdded ||
      !userNotificationRemoved ||
      !userFlagUpdated
    ) {
      await session.abortTransaction();
      const message = !updatedNotification
        ? "Failed to update notification!"
        : !userNotficationAdded
        ? "Failed to add notification to user!"
        : !userNotificationRemoved
        ? "Failed to remove notification from users!"
        : "Failed to update readFlag for users!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "Notification and users updated",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Update notification failed!", error);
  } finally {
    session.endSession();
  }
};

// @desc    Delete a notification
// @route   DELETE /notifications/:notificationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  const notificationId = context.params.notificationId;

  // check if the notificationId is valid
  if (!isObjectIdValid([notificationId])) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid notification ID!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Delete the notification and retrieve the affected users in one step
    const notificationDeleted = await Notification.findByIdAndDelete(
      notificationId,
      {
        session,
        select: "userRecipientsId",
        lean: true,
      }
    ) as INotification | null;

    if (!notificationDeleted) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Remove the notification from all users' notifications arrays
    const usersUpdated = await User.updateMany(
      { _id: { $in: notificationDeleted.userRecipientsId } },
      { $pull: { notifications: { notificationId } } },
      { session }
    );

    // Ensure both operations were successful
    if (usersUpdated.modifiedCount === 0 || !notificationDeleted) {
      await session.abortTransaction();
      const message =
        usersUpdated.modifiedCount === 0
          ? "Failed to update users!"
          : "Failed to delete notification!";
      return new NextResponse(JSON.stringify({ message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Commit transaction if all steps were successful
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({ message: "Notification deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Delete notification failed!", error);
  } finally {
    session.endSession();
  }
};
