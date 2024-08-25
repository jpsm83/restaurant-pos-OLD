import connectDB from "@/app/lib/db";
import Business from "@/app/lib/models/business";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import Table from "@/app/lib/models/table";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";
import { Types } from "mongoose";

export const createTable = async (
  tableReference: string,
  guests: number,
  openedBy: Types.ObjectId,
  responsibleBy: Types.ObjectId,
  business: Types.ObjectId,
  clientName: string | undefined | null,
  dayReferenceNumber: number
) => {
  try {
    // check required fields
    if (
      !tableReference ||
      !guests ||
      !openedBy ||
      !responsibleBy ||
      !business ||
      !dayReferenceNumber
    ) {
      return "TableReference, guest, openedBy, responsibleBy, business and dayReferenceNumber are required!";
    }

    // connect before first call to DB
    await connectDB();

    // check if tableReference exists in the business
    const validateSalesLocationReference = await Business.findOne({
      _id: business,
      salesLocation: {
        $elemMatch: { locationReferenceName: tableReference }
      }
    });

    // check if tableReference exists in the business (pre set tables that can be used)
    if (!validateSalesLocationReference) {
      return "TableReference does not exist in this business!";
    }

    // create a tables object with required fields
    const tableObj = {
      dayReferenceNumber: dayReferenceNumber,
      tableReference,
      guests,
      openedBy,
      responsibleBy,
      business,
      clientName: clientName || undefined,
    };

    // check if user exists in the dailySalesReport
    const userDailySalesReport = await DailySalesReport.findOne({
      dayReferenceNumber: dayReferenceNumber,
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
