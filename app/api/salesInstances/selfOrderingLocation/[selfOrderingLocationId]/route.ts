import { NextResponse } from "next/server";
import { IDailySalesReport } from "@/app/lib/interface/IDailySalesReport";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// imported models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import SalesInstance from "@/app/lib/models/salesInstance";
import SalesPoint from "@/app/lib/models/salesPoint";
import { createDailySalesReport } from "@/app/api/dailySalesReports/utils/createDailySalesReport";
import { createSalesInstance } from "../../utils/createSalesInstance";
import { Types } from "mongoose";

// first create a empty salesInstance, then update it with the salesGroup.ordersIds
// @desc    Create new salesInstances
// @route   POST /salesInstances/selfOrderingLocation/:selfOrderingLocationId
// @access  Private


// self ordering will do all the flow at once
// create the table
// create the order
// create the payment
// update the dailySalesReport



export const POST = async (
  req: Request,
  context: { params: { selfOrderingLocationId: Types.ObjectId } }
) => {
  // 1. employee will scan the QR code
  // 2. if your has an accout it will be redirected to the selfOrdering page
  // 3. if not, the employee will be redirected to the register page (with google or facebook)
  // 4. he will be redirect to the selfOrdering page
  // 5. the employee will select what he wants to eat and drink
  // 6. the employee will pay for the order
  // 7. the employee will receive a confirmation message with the order number
  // 8. the order will be done and delivered to the employee in the salesPoint location
  try {
    const selfOrderingLocationId = context.params.selfOrderingLocationId;
    const { openedByEmployeeId, businessId } = (await req.json()) as ISalesInstance;

    // check required fields
    if (!selfOrderingLocationId || !openedByEmployeeId || !businessId) {
      return new NextResponse(
        JSON.stringify({
          message:
            "SalesInstanceReference, guest, openedByEmployeeId and businessId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // validate ids
    if (
      isObjectIdValid([selfOrderingLocationId, openedByEmployeeId, businessId]) !== true
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "OpenedBy or businessId not valid!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check salesPointId exists
    if (
      !(await SalesPoint.exists({
        _id: selfOrderingLocationId,
      }))
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales point does not exist in this business!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // **** IMPORTANT ****
    // dailySalesReport is created when the first salesInstance of the day is created
    const dailySalesReport: IDailySalesReport | null =
      await DailySalesReport.findOne({
        isDailyReportOpen: true,
        businessId,
      })
        .select("dailyReferenceNumber")
        .lean();

    const dailyReferenceNumber = dailySalesReport
      ? dailySalesReport.dailyReferenceNumber
      : await createDailySalesReport(businessId);

    if (
      await SalesInstance.exists({
        dailyReferenceNumber: dailyReferenceNumber,
        businessId,
        salesPointId: selfOrderingLocationId,
        status: { $ne: "Closed" },
      })
    ) {
      return new NextResponse(
        JSON.stringify({
          message: "SalesInstance already exists and it is not closed!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // create new salesInstance
    const newSalesInstanceObj = {
      dailyReferenceNumber,
      salesPointId: selfOrderingLocationId,
      guests: 1,
      openedByEmployeeId,
      responsibleById: openedByEmployeeId,
      status: "Occupied",
      businessId,
      clientName: "get the client name on the employee query",
    };

    // we use a outside function to create the salesInstance because this function is used in other places
    // create new salesInstance
    await createSalesInstance(newSalesInstanceObj);

    return new NextResponse(
      JSON.stringify({
        message: "SalesInstance created successfully!",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create salesInstance failed!", error);
  }
};
