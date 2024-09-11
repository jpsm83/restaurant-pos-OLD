import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";

// import models
import User from "@/app/lib/models/user";
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addUserToDailySalesReport } from "./utils/addUserToDailySalesReport";
import { createDailySalesReport } from "./utils/createDailySalesReport";
import { updateUserDailySalesReportGeneric } from "./utils/updateUserDailySalesReportGeneric";
import { closeDailySalesReport } from "./utils/closeDailySalesReport";

// @desc    Get all daily reports
// @route   GET /dailySalesReports
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

    const dailySalesReports = await DailySalesReport.find()
      .populate({
        path: "usersDailySalesReport.user",
        select: "username",
        model: User,
      })
      .lean();

    return !dailySalesReports.length
      ? new NextResponse(
          JSON.stringify({ message: "No daily reports found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(dailySalesReports), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get daily sales reports tables failed!", error);
  }
};

// // POST request for helper funtions
// export const POST = async (req: Request) => {
//   try {
//     const userId = "66758b8904c4e6f5bbaa6b81";
//     const dailyReferenceNumber = 1723974290376;
//     const businessId = "6673fed98c45d0a0ca5f34c1";

//     // // @ts-ignore
//     // const result = await addUserToDailySalesReport(userId, businessId);

//     // // @ts-ignore
//     // const result = await createDailySalesReport(businessId);

//     // // @ts-ignore
//     // const result = await updateUserDailySalesReportGeneric(userId, dailyReferenceNumber);

//     // @ts-ignore
//     const result = await closeDailySalesReport(dailyReferenceNumber, businessId);

//     return new NextResponse(JSON.stringify({ message: result }), {
//       status: 201,
//       headers: { "Content-Type": "application/json" },
//     });
//   } catch (error) {
//     return handleApiError("Create daily sales report failed!", error);
//   }
// };
