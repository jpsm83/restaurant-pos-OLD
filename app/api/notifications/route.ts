import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get all notifications
// @route   GET /notifications
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find()
      .populate("recipients", "username")
      .lean();

    return !notifications.length
      ? new NextResponse(
          JSON.stringify({ message: "No notifications found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(notifications), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get all notifications failed!", error);
  }
};

// @desc    Create a new notification
// @route   POST /notifications
// @access  Private
export const POST = async (req: Request) => {
  try {
    // recipients have to be an array of user IDs coming from the front end
    const { notificationType, message, recipients, business, sender } =
      (await req.json()) as INotification;

    // check required fields
    if (!notificationType || !message || !recipients || !business) {
      return new NextResponse(
        JSON.stringify({
          message:
            "NotificationType, message, recipients and business are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate recipients
    if (!Array.isArray(recipients)) {
      return new NextResponse(
        JSON.stringify({
          message: "Recipients must be an array of user IDs or empty!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // create new notification object
    const notificationObj = {
      notificationType,
      message,
      recipients: recipients,
      business,
      sender: sender || undefined,
    };

    // connect before first call to DB
    await connectDb();

    // save new notification
    const newNotification = await Notification.create(notificationObj);

    if (newNotification) {
      // add the notification to the recipients users
      const sendNotifications = await User.updateMany(
        { _id: { $in: recipients } },
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
              "Notification could not be add on user but has been created!",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new NextResponse(
        JSON.stringify({
          message: `Notification message created and sent to users`,
        }),
        {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }
      );
    } else {
      return new NextResponse(
        JSON.stringify({ message: "Notification could not be created!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    return handleApiError("Create notification failed!", error);
  }
};
