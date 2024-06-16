import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/lib/models/dailySalesReport";

// @desc    Get daily reports by business ID
// @route   GET /dailySalesReports/business/:businessId
// @access  Private
export const GET = async (context: {
  params: any;
}) => {
  try {
    const businessId = context.params.businessId;

    // check if the ID is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const dailySalesReports = await DailySalesReport.find({
      business: businessId,
    })
      .populate("usersDailySalesReport.user", "username")
      .lean();

    return !dailySalesReports.length
      ? new NextResponse(
          JSON.stringify({ message: "No daily reports found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(dailySalesReports), { status: 200 });
  } catch (error: any) {
    new NextResponse("Error: " + error, { status: 500 });
  }
};
