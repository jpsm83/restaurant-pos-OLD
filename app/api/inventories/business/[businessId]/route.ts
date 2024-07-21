import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import Inventory from "@/app/lib/models/inventory";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

// @desc    Get inventories by business ID and range of dates
// @route   GET /inventories/business/:businessId?startDate=<date>&endDate=<date>
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;
    // check if the businessId is valid
    if (!Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid inventory ID" }),
        { status: 400 }
      );
    }

    // date will como from the front as ex: "2023-04-01T15:00:00", create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.

    // Parse query parameters for optional date range
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Convert date string to date object at the start of the day in UTC
    const startOfDay = startDate
      ? new Date(startDate.split("T")[0] + "T00:00:00.000Z")
      : null;

    const endOfDay = endDate
      ? new Date(endDate.split("T")[0] + "T23:59:59.999Z")
      : null;

    // Build the query based on the presence of startDate and endDate
    let query: {
      business: Types.ObjectId;
      createdAt?: { $gte?: Date | null; $lte?: Date | null };
    } = { business: businessId };

    if (startDate && endDate) {
      if (startDate > endDate) {
        return new NextResponse(
          "Invalid date range, start date must be before end date!",
          {
            status: 400,
          }
        );
      }
      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    // connect before first call to DB
    await connectDB();

    // just get basic information user visualisation, not the whole inventory
    // user will be able to click on the inventory to see the details
    const inventories = await Inventory.find(query)
      .select("title countedDate doneBy comments")
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(inventories), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventories by business id failed!", error);
  }
};
