import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import { updateUserDailySalesReportGeneric } from "../../utils/updateUserDailySalesReportGeneric";

// this function will call the updateUserDailySalesReportGeneric function to update the user daily sales report
// this is called individually for each user
// @desc    Update user daily report
// @route   PATCH /dailySalesReports/:dailySalesReportId/user/:userId
// @access  Private
export const PATCH = async (context: { params: any }) => {
  try {
    const { dailySalesReportId, userId } = context.params;

    // check if the ID is valid
    if (
      !userId ||
      !Types.ObjectId.isValid(userId) ||
      !dailySalesReportId ||
      !Types.ObjectId.isValid(dailySalesReportId)
    ) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport or user ID" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    // get the daily report to update
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({ _id: dailySalesReportId })
        .select("_id dayReferenceNumber")
        .lean();

    // check if daily report exists
    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily report not found" }),
        { status: 500 }
      );
    }

    // get the user daily sales report object
    const userDailySalesReportObj = await updateUserDailySalesReportGeneric(
      userId,
      dailySalesReport.dayReferenceNumber
    );

    // update the document in the database
    const updatedUserDailySalesReport = await DailySalesReport.findOneAndUpdate(
      { _id: dailySalesReportId, "usersDailySalesReport.user": userId },
      { $set: { "usersDailySalesReport.$": userDailySalesReportObj } },
      { new: true, useFindAndModify: false }
    );

    return !updatedUserDailySalesReport
      ? new NextResponse(
          JSON.stringify({ message: "Failed to update user daily report!" }),
          { status: 500 }
        )
      : new NextResponse(
          JSON.stringify({ message: "User daily report updated!" }),
          { status: 200 }
        );
  } catch (error: any) {
    new NextResponse("Error: " + error, { status: 500 });
  }
};
