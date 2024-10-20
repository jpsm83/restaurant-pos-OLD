import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import Order from "@/app/lib/models/order";

// this is called by mananger or admin after the calculateBusinessDailySalesReport been executed
// the purpose of this function is to close the daily sales report
// @desc    Close the daily sales report
// @route   PATCH /dailySalesReports/:dailySalesReportId/closeDailySalesReport
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    const { userId } = (await req.json()) as {
      userId: Types.ObjectId;
    };

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId, userId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport or user ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Fetch the user and daily report details in parallel to save time
    const [user, dailySalesReport] = await Promise.all([
      User.findById(userId).select("currentShiftRole onDuty businessId").lean(),
      DailySalesReport.findById(dailySalesReportId)
        .select("dailyReferenceNumber")
        .lean(),
    ]);

    // Validate the user's role and whether they are on duty
    if (
      !user ||
      Array.isArray(user) ||
      ![
        "General Manager",
        "Manager",
        "Assistant Manager",
        "MoD",
        "Admin",
      ].includes(user.currentShiftRole ?? "") ||
      !user.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the daily sales report exists
    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily sales report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use a single query to check if there are open orders tied to the same business and reference number
    const openOrdersExist = await Order.exists({
      businessId: user.businessId,
      billingStatus: "Open",
      dailyReferenceNumber: Array.isArray(dailySalesReport)
        ? undefined
        : dailySalesReport.dailyReferenceNumber,
    });

    if (openOrdersExist) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You can't close the daily sales because there are open orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Close the daily sales report in a single operation
    const updatedReport = await DailySalesReport.findByIdAndUpdate(
      dailySalesReportId,
      { $set: { isDailyReportOpen: false } },
      { new: true, lean: true }
    );

    if (!updatedReport) {
      return new NextResponse(
        JSON.stringify({ message: "Failed to close the daily sales report!" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Respond with success
    return new NextResponse(
      JSON.stringify({ message: "Daily sales report closed successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to close daily sales report!", error);
  }
};
