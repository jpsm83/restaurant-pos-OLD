import { NextResponse } from "next/server";
import mongoose from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { INotification } from "@/app/lib/interface/INotification";

// imported models
import Notification from "@/app/lib/models/notification";
import User from "@/app/lib/models/user";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import Business from "@/app/lib/models/business";

// @desc    Get all notifications
// @route   GET /notifications
// @access  Public
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const notifications = await Notification.find()
      .populate({
        path: "userRecipientsId",
        select: "username",
        model: User,
      })
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
  // userRecipientsId have to be an array of user IDs coming from the front end
  const {
    notificationType,
    message,
    userRecipientsId,
    businessId,
    userSenderId,
  } = (await req.json()) as INotification;

  // check required fields
  if (!notificationType || !message || !userRecipientsId || !businessId) {
    return new NextResponse(
      JSON.stringify({
        message:
          "NotificationType, message, userRecipientsId and businessId are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

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

  if (!isObjectIdValid([...usersIds, businessId])) {
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

  // create new notification object
  const notificationObj = {
    notificationType,
    message,
    userRecipientsId,
    businessId,
    userSenderId: userSenderId || undefined,
  };

  // connect before first call to DB
  await connectDb();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check if the business and users exist
    const [business, users] = await Promise.all([
      Business.exists({ _id: businessId }),
      User.exists({ _id: { $in: usersIds } }),
    ]);

    if (!business || !users) {
      await session.abortTransaction();
      const message = !business ? "Business not found!" : "Users not found!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // save new notification
    const newNotification: INotification[] | null = await Notification.create(
      [notificationObj],
      { session }
    );

    if (!newNotification) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification could not be created!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // add the notification to the userRecipientsId users
    const sendNotifications = await User.updateMany(
      { _id: { $in: userRecipientsId } },
      {
        $push: {
          notifications: {
            notificationId: newNotification[0]._id,
            readFlag: false,
          },
        },
      },
      { session }
    );

    // check if the notification was added to the users
    if (sendNotifications.modifiedCount === 0) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({
          message: "Failed to update users with notification!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: `Notification message created and sent to users`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Create notification failed!", error);
  } finally {
    session.endSession();
  }
};
