import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

import { INotification } from "@/app/interface/INotification";

// imported models
import Notification from "@/lib/models/notification";
import User from "@/lib/models/user";

// @desc    Get all notifications
// @route   GET /notifications
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const notifications = await Notification.find()
      .populate("recipient", "username")
      .lean();

    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(notifications), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Create a new notification
// @route   POST /notifications
// @access  Private
export const POST = async (req: Request) => {
  try {
    // connect before first call to DB
    await connectDB();

    // recipient have to be an array of user IDs coming from the front end
    const {
      dayReferenceNumber,
      notificationType,
      message,
      recipient,
      business,
      sender,
    } = req.body as unknown as INotification;

    // check required fields
    if (
      !dayReferenceNumber ||
      !notificationType ||
      !message ||
      !recipient ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "DayReferenceNumber, notificationType, message, recipient and business are required",
        }),
        { status: 400 }
      );
    }

    // create new notification object
    const notificationObj = {
      dayReferenceNumber,
      notificationType,
      message,
      recipient:
        Array.isArray(recipient) && recipient.length > 0
          ? recipient
          : undefined,
      business,
      sender: sender || undefined,
    };

    // save new notification
    const newNotification = await Notification.create(notificationObj);

    if (newNotification) {
      // add the notification to the recipient users
      const sendNotifications = await User.updateMany(
        { _id: { $in: recipient } },
        {
          $push: {
            notifications: {
              notification: newNotification._id,
              readFlag: false,
            },
          },
        }
      );

      // check if the notification was added to the users
      if (!sendNotifications) {
        return new NextResponse(
          JSON.stringify({
            message:
              "Notification could not be add on user but has been created",
          }),
          { status: 400 }
        );
      }
      return new NextResponse(
        JSON.stringify({ message: `Notification message created` }),
        { status: 201 }
      );
    } else {
      return new NextResponse(
        JSON.stringify({ message: "Notification could not be created" }),
        { status: 400 }
      );
    }
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
