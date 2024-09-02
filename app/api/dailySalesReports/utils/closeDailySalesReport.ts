import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// imported interfaces
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";

// this function will call the updateUserDailySalesReportGeneric function to update the user daily sales report
// them it will update the whole business daily sales report
// this is called by mananger or admin
export const closeDailySalesReport = async (
  dayReferenceNumber: number,
  businessId: Types.ObjectId
) => {
  try {
    // check required fields
    if (!dayReferenceNumber || !businessId) {
      return "Day reference number and businessId are required!";
    }

    // check if businessId is valid
    if (!Types.ObjectId.isValid(businessId)) {
      return "Invalid businessId!";
    }

    // connect before first call to DB
    await connectDB();

    // get the daily sales report
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        business: businessId,
        dayReferenceNumber: dayReferenceNumber,
        dailyReportOpen: true,
      })
        .select("_id usersDailySalesReport")
        .populate({
          path: "usersDailySalesReport.user",
          select: "username",
          model: User,
        })
        .lean();

    if (!dailySalesReport) {
      return "Daily sales report not found!";
    }

    if (
      dailySalesReport.usersDailySalesReport &&
      dailySalesReport.usersDailySalesReport.length > 0
    ) {
      // check if any user has open tables before closing the daily report
      const userWithOpenTables = dailySalesReport?.usersDailySalesReport.find(
        (user: any) => user.hasOpenTables
      );

      if (userWithOpenTables) {
        return "You cant close the daily sales because there are open tables!";
      }
    }

    await DailySalesReport.findByIdAndUpdate(
      dailySalesReport._id,
      {
        $set: {
          dailyReportOpen: false,
        },
      },
      { new: true }
    );

    return "Daily sales report closed";
  } catch (error) {
    return "Failed to close daily sales report! " + error;
  }
};
