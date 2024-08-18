import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { Types } from "mongoose";

// this function will create daily report if not exists
// it will be imported to be used on the tableController
// if a table is created and the daily report is not opened or doesnt exist it will create one
export const createDailySalesReport = async (businessId: Types.ObjectId) => {
  try {
    // check required fields
    if (!businessId) {
      return "Business is required!";
    }

    // check if daily report already exists with the business
    const dailyReportOpenExists = await DailySalesReport.findOne({
      dailyReportOpen: true,
      business: businessId,
    });

    if (dailyReportOpenExists) {
      return "There is an daily sales report opened!";
    }

    // get current date with real time to be the dayReferenceNumber
    // this is the countdownTimeToClose, date with time in unix format to set the limit to close the daily report regarding the date and time of the first table created
    const currentDateAndTime = new Date();
    const currentDateAndTimeUnix = currentDateAndTime.getTime();

    // miliseconds in a day
    const milisecondsInADay = 24 * 60 * 60 * 1000;

    // create daily report object
    const dailySalesReportObj: IDailySalesReport = {
      dayReferenceNumber: currentDateAndTimeUnix,
      dailyReportOpen: true,
      countdownTimeToClose: Number(currentDateAndTimeUnix) + milisecondsInADay,
      usersDailySalesReport: [],
      business: businessId,
    };

    const dailySalesReport: IDailySalesReport = await DailySalesReport.create(
      dailySalesReportObj
    );

    return `New daily sales report number ${dailySalesReport.dayReferenceNumber} created`;
  } catch (error) {
    return "Fail to create a deily sales report! " + error;
  }
};
