import connectDB from "@/lib/db";
import { NextResponse } from "next/server";

// imported models
import Notification from "@/lib/models/notification";
import { Types } from "mongoose";

// @desc    Get all notifications by business ID
// @route   GET /notifications/business/:businessId
// @access  Public
export const GET = async (context: {
  params: any;
}) => {
  try {
    // connect before first call to DB
    await connectDB();

    const businessId = context.params.businessId;
    // check if the businessId is valid
    if (!Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        { status: 400 }
      );
    }

    const notifications = await Notification.find({ business: businessId })
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
