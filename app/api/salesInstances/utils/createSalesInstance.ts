// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addEmployeeToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";

// imported interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import SalesInstance from "@/app/lib/models/salesInstance";

export const createSalesInstance = async (
  newSalesInstanceObj: ISalesInstance
) => {
  try {
    const requiredKeys = [
      "dailyReferenceNumber",
      "salesPointId",
      "guests",
      "status",
      "businessId",
    ];

    // check required fields
    for (const key of requiredKeys) {
      if (!(key in newSalesInstanceObj)) {
        return `${key} is missing!`;
      }
    }

    const {
      dailyReferenceNumber,
      openedByEmployeeId,
      openedByCustomerId,
      businessId,
    } = newSalesInstanceObj;

    // connect before first call to DB
    await connectDb();

    if (openedByEmployeeId) {
      // Check if the employee exists in the dailySalesReport
      if (
        !(await DailySalesReport.exists({
          dailyReferenceNumber: dailyReferenceNumber,
          businessId: businessId,
          "employeesDailySalesReport.employeeId": openedByEmployeeId,
        }))
      ) {
        await addEmployeeToDailySalesReport(openedByEmployeeId, businessId);
      }
    }

    if (openedByCustomerId) {
      // Create a logic to add the customer to the dailySalesReport
      if (
        !(await DailySalesReport.exists({
          dailyReferenceNumber: dailyReferenceNumber,
          businessId: businessId,
          "employeesDailySalesReport.employeeId": openedByEmployeeId,
        }))
      ) {
        // create a new service for the dailySalesReport customer
        await addEmployeeToDailySalesReport(openedByCustomerId, businessId);
      }
    }

    // Create the sales instance and return it
    const newSalesInstance = await SalesInstance.create(newSalesInstanceObj);

    // transferOrderBetweenTables needs the table object to transfer orders
    return newSalesInstance;
  } catch (error) {
    return "Create table failed!";
  }
};
