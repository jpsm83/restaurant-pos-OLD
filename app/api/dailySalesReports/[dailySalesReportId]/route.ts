import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import {
  ICardSales,
  ICryptoSales,
  IDailySalesReport,
  IOtherSales,
  IUserDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import User from "@/app/lib/models/user";

// @desc    Get daily report by ID
// @route   GET /dailySalesReports/:dailySalesReportId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    // check if the ID is valid
    if (!dailySalesReportId || !Types.ObjectId.isValid(dailySalesReportId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid daily report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const dailySalesReport = await DailySalesReport.findById(dailySalesReportId)
      .populate({
        path: "usersDailySalesReport.user",
        select: "username",
        model: User,
      })
      .lean();

    return !dailySalesReport
      ? new NextResponse(
          JSON.stringify({ message: "Daily report not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(dailySalesReport), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get daily sales report by its id failed!", error);
  }
};

// delete daily report shouldnt be allowed for data integrity and historical purtablees
// the only case where daily report should be deleted is if the business itself is deleted or report is empty
// @desc    Delete daily report
// @route   DELETE /dailySalesReports/:dailySalesReportId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    // check if the ID is valid
    if (!dailySalesReportId || !Types.ObjectId.isValid(dailySalesReportId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid daily report ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // delete daily report and check if it existed
    const result = await DailySalesReport.deleteOne({
      _id: dailySalesReportId,
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(`Daily report ${dailySalesReportId} deleted`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete daily sales report failed!", error);
  }
};
