import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

import { INotification } from "@/app/interface/INotification";

// imported models
import Notification from "@/lib/models/notification";
import User from "@/lib/models/user";
import { Types } from "mongoose";

// @desc    Get notification by ID
// @route   GET /notifications/:notificationId
// @access  Public
export const GET = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    const notification = await Notification.findById(notificationId)
      .populate("recipient", "username")
      .lean();

    return !notification
      ? new NextResponse(
          JSON.stringify({ message: "Notification not found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(notification), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update a notification
// @route   PATCH /notifications/:notificationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: any }
) => {
  try {
    // connect before first call to DB
    await connectDB();

    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    const { notificationType, message, recipient, sender } =
      req.body as unknown as INotification;

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
      recipient: recipient || notification.recipient,
      sender: sender || notification.sender,
    };

    // update notification
    const updatedNotification: INotification | null =
      await Notification.findByIdAndUpdate({ _id: notificationId }, updateObj, {
        new: true,
        usefindAndModify: false,
      }).lean();

    if (updatedNotification) {
      // find the recipients that were added
      const addedRecipients = recipient.filter(
        (userId) => !notification.recipient.includes(userId)
      );

      // find the recipients that were removed
      const removedRecipients = notification.recipient.filter(
        (userId) => !recipient.includes(userId)
      );

      // handle all the user updates at once
      const updateUserNotifications = await Promise.all([
        // add the notification to each new recipient user
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

        // remove the notification from each removed recipient user
        User.updateMany(
          { _id: { $in: removedRecipients } },
          { $pull: { notifications: { notification: notificationId } } }
        ),

        // update the readFlag for each new recipient
        User.updateMany(
          { _id: { $in: recipient }, "notifications._id": notificationId },
          { $set: { "notifications.$.readFlag": false } }
        ),
      ]);

      // check if users were updated
      if (!updateUserNotifications) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Notification could not be updated on users but the notification has been updated",
          }),
          { status: 400 }
        );
      }

      return new NextResponse(
        JSON.stringify({ message: `${message} notification updated` }),
        { status: 200 }
      );
    } else {
      return new NextResponse(
        JSON.stringify({ message: "Notification could not be updated" }),
        { status: 400 }
      );
    }
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Delete a notification
// @route   DELETE /notifications/:notificationId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const notificationId = context.params.notificationId;
    // check if the notificationId is valid
    if (!Types.ObjectId.isValid(notificationId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    // Fetch the notification
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return new NextResponse(
        JSON.stringify({ message: "Notification not found" }),
        { status: 404 }
      );
    }

    // Delete the notification
    await Notification.deleteOne({ _id: notificationId });

    // Remove the notification from each recipient user
    await User.updateMany(
      {
        _id: { $in: notification.recipient.map((userId: any) => userId.user) },
      },
      { $pull: { notifications: notificationId } }
    );

    return new NextResponse(
      JSON.stringify({ message: "Notification deleted" }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
