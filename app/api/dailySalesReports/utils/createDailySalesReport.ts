import { IDailySalesReport } from "@/app/interface/IDailySalesReport";
import DailySalesReport from "@/lib/models/dailySalesReport";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// this function will create daily report if not exists
// it will be imported to be used on the tableController
// if a table is created and the daily report is not opened or doesnt exist it will create one
export const createDailySalesReport = async (businessId: Types.ObjectId) => {
    try {
      // check required fields
      if (!businessId) {
        return new NextResponse("Business is required!", { status: 500 });
      }
  
      // Get the current date from the start of the day
      // this is the dayReferenceNumber, date without time in unix format
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      const currentDateUnix = currentDate.getTime();
  
      // get current date with real time
      // this is the countdownTimeToClose, date with time in unix format to set the limit to close the daily report regarding the date and time of the first table created
      const currentDateAndTime = new Date();
      const currentDateAndTimeUnix = currentDateAndTime.getTime();
  
      // miliseconds in a day
      const milisecondsInADay = 24 * 60 * 60 * 1000;
  
      const dailySalesReportObj: IDailySalesReport = {
        dayReferenceNumber: currentDateUnix,
        dailyReportOpen: true,
        countdownTimeToClose: Number(currentDateAndTimeUnix) + milisecondsInADay,
        usersDailySalesReport: [],
        business: businessId,
      };
      const dailySalesReport: IDailySalesReport = await DailySalesReport.create(
        dailySalesReportObj
      );
  
      if (!dailySalesReport) {
        return new NextResponse("Failed to create daily report!", {
          status: 500,
        });
      }
  
      return dailySalesReport.dayReferenceNumber;
    } catch (error: any) {
      return new NextResponse("Error: " + error, { status: 500 });
    }
  };
  