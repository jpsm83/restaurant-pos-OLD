import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get daily reports by business ID, startDate and endDate
// @route   GET /dailySalesReports/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;

    // check if the ID is valid
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse("Invalid business ID!", { status: 400 });
    }

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build query based on the presence of startDate and endDate
    let query: {
      business: Types.ObjectId;
      createdAt?: { $gte: Date, $lte: Date };
    } = { business: businessId };

    if (startDate && endDate) {
      if(startDate > endDate){
        return new NextResponse("Invalid date range, start date must be before end date!", {
          status: 400,
        });
      }
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    // connect before first call to DB
    await connectDB();

    // fetch daily reports with the given business ID and date
    const dailySalesReports = await DailySalesReport.find(query)
      .populate("usersDailySalesReport.user", "username")
      .lean();

    return !dailySalesReports.length
      ? new NextResponse("No daily reports found!",
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(dailySalesReports), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return handleApiError("Get daily sales report by business id failed!", error);
  }
};
