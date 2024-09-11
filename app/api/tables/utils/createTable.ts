import connectDb from "@/app/lib/utils/connectDb";
import Business from "@/app/lib/models/business";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Table from "@/app/lib/models/salesLocation";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";
import { Types } from "mongoose";

export const createTable = async (
  salesLocationReference: string,
  guests: number,
  openedBy: Types.ObjectId,
  responsibleBy: Types.ObjectId,
  business: Types.ObjectId,
  clientName: string | undefined | null,
  dailyReferenceNumber: number
) => {
  try {
    // check required fields
    if (
      !salesLocationReference ||
      !guests ||
      !openedBy ||
      !responsibleBy ||
      !business ||
      !dailyReferenceNumber
    ) {
      return "SalesLocationReference, guest, openedBy, responsibleBy, business and dailyReferenceNumber are required!";
    }

    // connect before first call to DB
    await connectDb();

    // check if salesLocationReference exists in the business
    const validateSalesLocationReference = await Business.findOne({
      _id: business,
      salesLocation: {
        $elemMatch: { locationReferenceName: salesLocationReference }
      }
    });

    // check if salesLocationReference exists in the business (pre set tables that can be used)
    if (!validateSalesLocationReference) {
      return "SalesLocationReference does not exist in this business!";
    }

    // create a tables object with required fields
    const tableObj = {
      dailyReferenceNumber: dailyReferenceNumber,
      salesLocationReference,
      guests,
      openedBy,
      responsibleBy,
      business,
      clientName: clientName || undefined,
    };

    // check if user exists in the dailySalesReport
    const userDailySalesReport = await DailySalesReport.findOne({
      dailyReferenceNumber: dailyReferenceNumber,
      business,
      "userDailySalesReportArray.user": openedBy,
    }).lean();

    // if user does not exist in the dailySalesReport, create it
    if (!userDailySalesReport) {
      await addUserToDailySalesReport(openedBy, tableObj.business);
    }

    // create the table
    const newTable = await Table.create(tableObj);

    if (newTable) {
      return newTable;
    } else {
      return "Table not created!";
    }
  } catch (error) {
    return "Create table failed!";
  }
};
