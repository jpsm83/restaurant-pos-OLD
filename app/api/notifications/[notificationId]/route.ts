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
import Employee from "@/app/lib/models/employee";

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
        path: "employeeRecipientsId",
        select: "employeeName",
        model: Employee,
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

  const { notificationType, message, employeeRecipientsId, employeeSenderId } =
    (await req.json()) as INotification;

  // validate employeeRecipientsId
  if (
    !Array.isArray(employeeRecipientsId) ||
    employeeRecipientsId.length === 0
  ) {
    return new NextResponse(
      JSON.stringify({
        message: "Recipients must be an array of employee IDs!",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // validation ids
  const employeesIds = [...employeeRecipientsId];
  if (employeeSenderId) {
    employeesIds.push(employeeSenderId);
  }

  if (!isObjectIdValid([...employeesIds, notificationId])) {
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
    // check all employees exist and get notification object
    const [employees, notification] = await Promise.all([
      // "exists" will return true if at least one document exists, so we need to use "find" instead
      Employee.find({ _id: { $in: employeesIds } }, null, { lean: true }), // Fetch employees in a single query
      Notification.findById(notificationId)
        .select("employeeRecipientsId message")
        .lean()
        .session(session) as Promise<INotification | null>,
    ]);

    if (employees.length !== employeesIds.length || !notification) {
      await session.abortTransaction();
      const message =
        employees.length !== employeesIds.length
          ? "One or more employees do not exist!"
          : "Notification not found";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Find the employeeRecipientsId that were added
    const addedRecipients = employeeRecipientsId.filter(
      (employeeId) =>
        !notification.employeeRecipientsId
          .toString()
          .includes(employeeId.toString())
    );

    // Find the employeeRecipientsId that were removed
    const removedRecipients = notification.employeeRecipientsId.filter(
      (employeeId: Types.ObjectId) =>
        !employeeRecipientsId.toString().includes(employeeId.toString())
    );

    // Find the employeeRecipientsId that were not changed
    const unchangedRecipients = employeeRecipientsId.filter((employeeId) =>
      notification.employeeRecipientsId
        .toString()
        .includes(employeeId.toString())
    );

    // prepare the update object
    const updateNotification: Partial<INotification> = {};

    if (notificationType)
      updateNotification.notificationType = notificationType;
    if (message) updateNotification.message = message;
    if (employeeRecipientsId)
      updateNotification.employeeRecipientsId = employeeRecipientsId;
    if (employeeSenderId)
      updateNotification.employeeSenderId = employeeSenderId;

    // handle all the employee updates at once
    const [
      updatedNotification,
      employeeNotficationAdded,
      employeeNotificationRemoved,
      employeeFlagUpdated,
    ] = await Promise.all([
      // update notification
      Notification.updateOne(
        { _id: notificationId },
        { $set: updateNotification },
        {
          session,
        }
      ),

      // Add notification to new employees' notifications array
      addedRecipients.length > 0
        ? Employee.updateMany(
            { _id: { $in: addedRecipients } },
            { $push: { notifications: { notificationId, readFlag: false } } }, // Set readFlag to false for new employees
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added

      // Remove notification from old employees' notifications array
      removedRecipients.length > 0
        ? Employee.updateMany(
            { _id: { $in: removedRecipients } },
            { $pull: { notifications: { notificationId } } },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added

      // update the readFlag for each unchangedRecipients
      unchangedRecipients.length > 0 && notification.message !== message
        ? Employee.updateMany(
            {
              _id: { $in: employeeRecipientsId },
              "notifications.notificationId": notificationId,
            },
            {
              $set: {
                "notifications.$.readFlag": false,
                "notifications.$.deletedFlag": false,
              },
            },
            { session }
          )
        : Promise.resolve(true), // Resolve with a success flag if no recipients added
    ]);

    if (
      !updatedNotification ||
      !employeeNotficationAdded ||
      !employeeNotificationRemoved ||
      !employeeFlagUpdated
    ) {
      await session.abortTransaction();
      const message = !updatedNotification
        ? "Failed to update notification!"
        : !employeeNotficationAdded
        ? "Failed to add notification to employee!"
        : !employeeNotificationRemoved
        ? "Failed to remove notification from employees!"
        : "Failed to update readFlag for employees!";
      return new NextResponse(JSON.stringify({ message: message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "Notification and employees updated",
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
    // Delete the notification and retrieve the affected employees in one step
    const notificationDeleted = (await Notification.findByIdAndDelete(
      notificationId,
      {
        session,
        select: "employeeRecipientsId",
        lean: true,
      }
    )) as INotification | null;

    if (!notificationDeleted) {
      await session.abortTransaction();
      return new NextResponse(
        JSON.stringify({ message: "Notification not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Remove the notification from all employees' notifications arrays
    const employeesUpdated = await Employee.updateMany(
      { _id: { $in: notificationDeleted.employeeRecipientsId } },
      { $pull: { notifications: { notificationId } } },
      { session }
    );

    // Ensure both operations were successful
    if (employeesUpdated.modifiedCount === 0 || !notificationDeleted) {
      await session.abortTransaction();
      const message =
        employeesUpdated.modifiedCount === 0
          ? "Failed to update employees!"
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
