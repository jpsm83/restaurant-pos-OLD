import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// imported interfaces
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { NextResponse } from "next/server";
import { IUser } from "@/app/lib/interface/IUser";
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

    // check if the user is "General Manager", "Manager", "Assistant Manager", "MoD" or "Admin"
    const user: IUser | null = await User.findById(userId)
      .select("currentShiftRole onDuty businessId")
      .lean();

    const allowedRoles = [
      "General Manager",
      "Manager",
      "Assistant Manager",
      "MoD",
      "Admin",
    ];

    if (
      !user ||
      !allowedRoles.includes(user.currentShiftRole ?? "") ||
      !user.onDuty
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "You are not allowed to close the daily sales report!",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the daily sales report
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        businessId: user.businessId,
        isDailyReportOpen: true,
      })
        .select("dailyReferenceNumber")
        .lean();

    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily sales report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the are no open orders for the day
    if (
      await Order.exists({
        businessId: user.businessId,
        billingStatus: "Open",
        dailyReferenceNumber: dailySalesReport.dailyReferenceNumber,
      })
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "You cant close the daily sales because there are open orders!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await DailySalesReport.findByIdAndUpdate(
      dailySalesReportId,
      {
        $set: {
          isDailyReportOpen: false,
        },
      },
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({ message: "Daily sales report closed" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Failed to close daily sales report!", error);
  }
};
