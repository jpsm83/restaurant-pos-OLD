// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { addEmployeeToDailySalesReport } from "../../dailySalesReports/utils/addEmployeeToDailySalesReport";

// imported interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import Table from "@/app/lib/models/salesInstance";
import DailySalesReport from "@/app/lib/models/dailySalesReport";

export const createSalesInstance = async (
  newSalesLocationObj: ISalesInstance
) => {
  try {
    const requiredKeys = [
      "dailyReferenceNumber",
      "salesPointId",
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

    const { dailyReferenceNumber, openedById, businessId } =
      newSalesLocationObj;

    // connect before first call to DB
    await connectDb();

    // Check if the employee exists in the dailySalesReport
    if (
      !(await DailySalesReport.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId: businessId,
        "employeesDailySalesReport.employeeId": openedById,
      }))
    ) {
      await addEmployeeToDailySalesReport(openedById, businessId);
    }

    // Create the sales location and return it
    const newSalesLocation = await Table.create(newSalesLocationObj);

    // transferOrderBetweenTables needs the table object to transfer orders
    return newSalesLocation;
  } catch (error) {
    return "Create table failed!";
  }
};
