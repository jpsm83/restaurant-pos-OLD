import DailySalesReport from "@/app/lib/models/dailySalesReport";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { Types } from "mongoose";

// add user to daily sales report
export const addUserToDailySalesReport = async (
  userId: Types.ObjectId,
  businessId: Types.ObjectId
) => {
  try {
    // validate ids
    if (isObjectIdValid([userId, businessId]) !== true) {
      return "Invalid user or business ID!";
    }

    // Find the open daily sales report and add the user in one operation
    const updatedDailySalesReport = await DailySalesReport.findOneAndUpdate(
      {
        isDailyReportOpen: true,
        business: businessId,
      },
      {
        $addToSet: { usersDailySalesReport: { userId } }, // Avoid duplicates
      },
      { new: true } // Return the updated document
    ).lean();

    // If no daily sales report found
    if (!updatedDailySalesReport) {
      return "Daily report not found!";
    }

    // no need to return the updated document - just for testing purposes
    return "User added to daily report successfully!";
  } catch (error) {
    return "Failed to add user to daily report! " + error;
  }
};
