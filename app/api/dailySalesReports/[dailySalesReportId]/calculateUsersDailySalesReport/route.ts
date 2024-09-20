import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { updateUsersDailySalesReport } from "../../utils/updateUserDailySalesReport";

// imported interfaces
import {
  IDailySalesReport,
  IUserDailySalesReport,
} from "@/app/lib/interface/IDailySalesReport";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// @desc    Calculate the user daily sales report
// @route   PATCH /dailySalesReports/:dailySalesReportId/calculateUsersDailySalesReport
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { dailySalesReportId: Types.ObjectId } }
) => {
  // this function will call the updateUsersDailySalesReport function to update individual user daily sales report or many at time
  // this will be call by the user when it shif is done or just to see the report at the current time
  // and also will be call by manangers or admin to update all users daily sales report at once
  try {
    const dailySalesReportId = context.params.dailySalesReportId;

    const { userIds } = (await req.json()) as { userIds: Types.ObjectId[] };

    // Ensure userIds is an array and not empty
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return new NextResponse(
        JSON.stringify({ message: "User IDs must be a non-empty array!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the ID is valid
    if (isObjectIdValid([dailySalesReportId, ...userIds]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid dailySalesReport or user ID!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // get the daily sales report
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findById(dailySalesReportId)
        .select("dailyReferenceNumber")
        .lean();

    if (!dailySalesReport) {
      return new NextResponse(
        JSON.stringify({ message: "Daily sales report not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Call the function to update the daily sales reports for the users
    const result = (await updateUsersDailySalesReport(
      userIds,
      dailySalesReport.dailyReferenceNumber
    )) as { updatedUsers: IUserDailySalesReport[]; errors: string[] };

    // Check if there were any errors
    if (result.errors && result.errors.length > 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Some errors occurred while updating users!",
          errors: result.errors,
        }),
        {
          status: 207, // Multi-Status to indicate partial success
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // If successful, return the updated users' reports
    return new NextResponse(JSON.stringify(result.updatedUsers), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Get daily sales report by user id failed!", error);
  }
};
