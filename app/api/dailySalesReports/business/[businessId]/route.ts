import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/lib/models/dailySalesReport";

// @desc    Get daily reports by business ID, startDate and endDate
// @route   GET /dailySalesReports/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (req: Request, context: {
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

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

        // Parse query parameters for optional date range
        const { searchParams } = new URL(req.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        
    // convert date string to date object
    const startOfDay = startDate ? new Date(startDate) : null;
    if (startOfDay) {
      startOfDay.setHours(0, 0, 0, 0); // Set to the start of the day
    }
    
    const endOfDay = endDate ? new Date(endDate) : null;
    if (endOfDay) {
      endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day
    }

  // connect before first call to DB
  await connectDB();

  // Build the query based on the presence of startDate and endDate
  let query: { business: Types.ObjectId, createdAt?: { $gte: Date, $lte: Date } } = { business: businessId };
  if (startDate && endDate) {
    query = {
      ...query,
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };
  }
  
  // fetch daily reports with the given business ID and date
    const dailySalesReports = await DailySalesReport.find({
      query
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