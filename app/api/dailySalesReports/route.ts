import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// @desc    Get all daily reports
// @route   GET /dailySalesReports
// @access  Private
export const getDailySalesReports = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const dailySalesReports = await DailySalesReport.find()
      .populate("usersDailySalesReport.user", "username")
      .lean();

    return dailySalesReports.length
      ? new NextResponse(JSON.stringify(dailySalesReports), { status: 200 })
      : new NextResponse(
          JSON.stringify({ message: "No daily reports found" }),
          { status: 404 }
        );
  } catch (error: any) {
    new NextResponse("Error: " + error, { status: 500 });
  }
};
