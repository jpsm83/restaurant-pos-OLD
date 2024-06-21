import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get notification by ID
// @route   GET /notifications/:notificationId
// @access  Public
export const GET = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  try {
    // connect before first call to DB
    await connectDB();

    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse("Invalid notification ID", { status: 400 });
    }

    const notification = await Notification.findById(notificationId)
      .populate("recipients", "username")
      .lean();

    return !notification
      ? new NextResponse("Notification not found", { status: 404 })
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
  try {
    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse("Invalid notification ID!", { status: 400 });
    }

    const { notificationType, message, recipients, sender } =
      (await req.json()) as INotification;

    // connect before first call to DB
    await connectDB();

    // check if notification exists
    const notification: INotification | null = await Notification.findById(
      notificationId
    ).lean();

    if (!notification) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found" }),
        { status: 404 }
      );
    }

    // prepare the update object
    const updateObj = {
      notificationType: notificationType || notification.notificationType,
      message: message || notification.message,
      recipients: recipients || notification.recipients,
      sender: sender || notification.sender,
    };

    // update notification
    const updatedNotification: INotification | null =
      await Notification.findByIdAndUpdate(notificationId, updateObj, {
        new: true,
        usefindAndModify: false,
      }).lean();

    if (updatedNotification) {
      // find the recipients that were added
      const addedRecipients = updateObj.recipients.filter(
        (userId) => !notification.recipients.includes(userId)
      );

      // find the recipients that were removed
      const removedRecipients = notification.recipients.filter(
        (userId) => !updateObj.recipients.includes(userId)
      );

      // handle all the user updates at once
      const updateUserNotifications = await Promise.all([
        // add the notification to each new recipients user
        User.updateMany(
          { _id: { $in: addedRecipients } },
          {
            $push: {
              notifications: {
                notification: updatedNotification._id,
                readFlag: false,
              },
            },
          }
        ),

        // remove the notification from each removed recipients user
        User.updateMany(
          { _id: { $in: removedRecipients } },
          { $pull: { notifications: { notification: notificationId } } }
        ),

        // update the readFlag for each new recipients
        User.updateMany(
          { _id: { $in: recipients }, "notifications._id": notificationId },
          { $set: { "notifications.$.readFlag": false } }
        ),
      ]);

      // check if users were updated
      if (!updateUserNotifications) {
        return new NextResponse(
          "Notification could not be updated on users but the notification has been updated!",
          { status: 400 }
        );
      }

      return new NextResponse(`${updateObj.message} notification updated`, {
        status: 200,
      });
    } else {
      return new NextResponse("Notification could not be updated!", {
        status: 400,
      });
    }
  } catch (error) {
    return handleApiError("Update notification failed!", error);
  }
};

// @desc    Delete a notification
// @route   DELETE /notifications/:notificationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { notificationId: Types.ObjectId } }
) => {
  try {
    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse("Invalid notification ID!", { status: 400 });
    }

    // connect before first call to DB
    await connectDB();

    // Fetch the notification
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return new NextResponse("Notification not found!", { status: 404 });
    }

    // Remove the notification from each recipients user
    await User.updateMany(
      {
        _id: { $in: notification.recipients },
      },
      { $pull: { notifications: { notification: notificationId } } }
    );
    
    // Delete the notification
    await Notification.deleteOne({ _id: notificationId });

    return new NextResponse("Notification deleted", { status: 200 });
  } catch (error) {
    return handleApiError("Delete notification failed!", error);
  }
};
