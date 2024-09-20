import connectDb from "@/app/lib/utils/connectDb";
import Business from "@/app/lib/models/business";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Table from "@/app/lib/models/salesLocation";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";
import { Types } from "mongoose";
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

export const createSalesLocation = async (
  newSalesLocationObj: ISalesLocation
) => {
  try {
    const requiredKeys = [
      "dailyReferenceNumber",
      "salesLocationReference",
      "guests",
      "status",
      "openedById",
      "responsibleById",
      "businessId",
    ];

    // check required fields
    for (const key of requiredKeys) {
      if (!(key in newSalesLocationObj)) {
        return `${key} is missing!`;
      }
    }

    const {
      dailyReferenceNumber,
      openedById,
      businessId,
    } = newSalesLocationObj;

    // connect before first call to DB
    await connectDb();

    // Check if the user exists in the dailySalesReport
    if (
      !(await DailySalesReport.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId: businessId,
        "usersDailySalesReport.userId": openedById,
      }))
    ) {
      await addUserToDailySalesReport(openedById, businessId);
    }

    // Create the sales location and return it
    const newSalesLocation = await Table.create(newSalesLocationObj);

    // transferOrderBetweenTables needs the table object to transfer orders
    return newSalesLocation;
  } catch (error) {
    return "Create table failed!";
  }
};
