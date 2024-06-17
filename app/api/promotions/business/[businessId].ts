import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// imported models
import Promotion from "@/lib/models/promotion";
import { Types } from "mongoose";

// when bill is printed, check if orders have a promotion base on their order time
// if they have a promotion, apply it to the order updating its price and promotionApplied field

// @desc    Get promotion by business ID with optional date range
// @route   GET /promotion/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: any }
) => {
  try {
    const businessId = context.params.businessId;
    // Validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        {
          status: 400,
        }
      );
    }

    // date and time will como from the front as ex: "2023-04-01T15:00:00", you can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Connect to DB before first call
    await connectDB();

    // Build query based on the presence of startDate and endDate
    let query: {
      business: Types.ObjectId;
      "promotionPeriod.start"?: { $gte: Date };
      "promotionPeriod.end"?: { $lte: Date };
    } = { business: businessId };

    if (startDate && endDate) {
      query["promotionPeriod.start"] = { $gte: new Date(startDate) };
      query["promotionPeriod.end"] = { $lte: new Date(endDate) };
    }

    const promotion = await Promotion.find(query)
      .populate("businessGoodsToApply", "name sellingPrice")
      .lean();

    return !promotion.length
      ? new NextResponse(JSON.stringify({ message: "No promotion found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(promotion), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
