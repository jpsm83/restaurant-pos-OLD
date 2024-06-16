import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/lib/models/dailySalesReport";

// @desc    Get daily reports by business ID and reportDate
// @route   GET /dailySalesReports/business/:businessId/reportDate/:reportDate
// @access  Private
export const GET = async (context: {
  params: any;
}) => {
  try {
    const { businessId, reportDate } = context.params;

    // check if the ID is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid business ID" }),
        { status: 400 }
      );
    }

    // date will como from the front as ex: "2024-06-05", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // convert date string to date object
    const startOfDay = new Date(reportDate);
    startOfDay.setHours(0, 0, 0, 0); // Set to the start of the day

    const endOfDay = new Date(reportDate);
    endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    // connect before first call to DB
    await connectDB();

    // fetch daily reports with the given business ID and date
    const dailySalesReports = await DailySalesReport.find({
      business: businessId,
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
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