import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// add user to daily sales report
export const addUserToDailySalesReport = async (
  userId: Types.ObjectId,
  businessId: Types.ObjectId
) => {
  try {
    // check required fields
    if (!userId || !businessId) {
      return "UserId, and businessId are required!";
    }

    // check open daily report exists
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        dailyReportOpen: true,
        business: businessId,
      })
        .select("_id usersDailySalesReport.user")
        .lean();

    if (!dailySalesReport) {
      return "Daily report not found!";
    }

    // check if user already exists in the daily report
    const userExists = dailySalesReport.usersDailySalesReport.find(
      (user) => user.user == userId
    );

    if (userExists) {
      return "User already exists in the daily report!";
    }

    // add user to the daily report
    const userDailySalesReportObj = {
      user: userId,
    };

    // update the document in the database
    await DailySalesReport.findOneAndUpdate(
      { _id: dailySalesReport._id },
      { $push: { usersDailySalesReport: userDailySalesReportObj } },
      { new: true }
    );

    return "User added to daily report successfully!";
  } catch (error) {
    return "Failed to add user to daily report! " + error;
  }
};
