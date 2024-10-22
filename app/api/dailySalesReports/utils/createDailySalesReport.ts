import { Types } from "mongoose";

// imported utils
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// imported interfaces
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// this function will create daily report if not exists
// it will be imported to be used on the salesInstance route
// if a sales instance is created and the daily report is not opened or doesnt exist it will create one
export const createDailySalesReport = async (businessId: Types.ObjectId) => {
  try {
    // check required fields
    if (isObjectIdValid([businessId]) !== true) {
      return "Business ID not valid!";
    }

    // get current date with real time to be the dailyReferenceNumber
    const currentTimeUnix = Date.now();

    // miliseconds in a day - this will be add to the currentTimeUnix to create the timeCountdownToClose - 1 day from the current date to be the time to close the daily report
    const millisecondsInADay = 24 * 60 * 60 * 1000;
    const countdownToClose = currentTimeUnix + millisecondsInADay;

    // create daily report object
    const dailySalesReportObj: IDailySalesReport = {
      dailyReferenceNumber: currentTimeUnix,  // This should be a valid number
      isDailyReportOpen: true,
      timeCountdownToClose: countdownToClose,
      employeesDailySalesReport: [],
      businessId: businessId,
    };

    const dailySalesReport = await DailySalesReport.create(dailySalesReportObj);
    
    // return daily reference number
    return dailySalesReport.dailyReferenceNumber;
  } catch (error) {
    return "Fail to create a deily sales report! " + error;
  }
};
