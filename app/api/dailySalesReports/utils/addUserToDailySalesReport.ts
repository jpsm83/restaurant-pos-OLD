import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// add user to daily sales report
export const addUserToDailySalesReport = async (
    userId: Types.ObjectId,
    dayReferenceNumber: number,
    businessId: Types.ObjectId
  ) => {
    try {
      // check required fields
      if (!userId || !dayReferenceNumber || !businessId) {
        return new NextResponse(
          "UserId, dayReferenceNumber and businessId are required!",
          { status: 500 }
        );
      }
  
      // check daily report exists
      const dailySalesReport: IDailySalesReport | null =
        await DailySalesReport.findOne({
          dayReferenceNumber: dayReferenceNumber,
          business: businessId,
        })
          .select("_id")
          .lean();
  
      if (!dailySalesReport) {
        return new NextResponse("Daily report not found!", { status: 500 });
      }
  
      // add user to the daily report
      const userDailySalesReportObj = {
        user: userId,
      };
  
      // update the document in the database
      const updatedDailySalesReport = await DailySalesReport.findOneAndUpdate(
        { _id: dailySalesReport._id },
        { $push: { usersDailySalesReport: userDailySalesReportObj } },
        { new: true, useFindAndModify: false }
      );
  
      if (!updatedDailySalesReport) {
        return new NextResponse(
          "Failed to add user with ID " + userId + " to daily report!",
          { status: 500 }
        );
      }
    } catch (error: any) {}
  };
  