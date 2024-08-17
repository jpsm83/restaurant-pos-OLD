import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { addUserToDailySalesReport } from "./utils/addUserToDailySalesReport";
import { createDailySalesReport } from "./utils/createDailySalesReport";
import { updateUserDailySalesReportGeneric } from "./utils/updateUserDailySalesReportGeneric";

// @desc    Get all daily reports
// @route   GET /dailySalesReports
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const dailySalesReports = await DailySalesReport.find()
      // .populate("usersDailySalesReport.user", "username")
      .lean();

    return !dailySalesReports.length
      ? new NextResponse(JSON.stringify({ message: "No daily reports found!"}), { status: 404, headers: { "Content-Type": "application/json" } })
      : new NextResponse(JSON.stringify(dailySalesReports), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get daily sales reports tables failed!", error);
  }
};

// POST request for helper funtions
export const POST = async (req: Request) => {
  try {
    const userId = "66758b8904c4e6f5bbaa6b81";
    const dayReferenceNumber = 1723974290376;
    const businessId = "6673fed98c45d0a0ca5f34c1";

    // // @ts-ignore
    // const result = await addUserToDailySalesReport(userId, businessId);

    // // @ts-ignore
    // const result = await createDailySalesReport(businessId);

    // @ts-ignore
    const result = await updateUserDailySalesReportGeneric(userId, dayReferenceNumber);

    return new NextResponse(JSON.stringify({message: result}), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Create daily sales report failed!", error);
  }
};
