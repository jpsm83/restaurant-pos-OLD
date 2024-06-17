import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// import models
import Inventory from "@/lib/models/inventory";

// @desc    Get inventories by business ID and range of dates
// @route   GET /inventories/business/:businessId/inventoriesRangeDate/:inventoriesRangeDate
// @access  Private
export const GET = async (context: {
  params: any;
}) => {
  try {
    // connect before first call to DB
    await connectDB();

    const { businessId, inventoriesRangeDate } = context.params;

    // date will como from the front as ex: "2024-05-05/2024-06-05", separate the dates on "/" and can create a Date object from it with new Date(startDate). This will create a Date object representing midnight on the given date in the LOCAL TIME ZONE OF THE SERVER.
    // If you need to ensure that the date represents midnight in a specific time zone, you may need to use a library like Moment.js or date-fns that supports time zones. These libraries can parse the date string and create a Date object in a specific time zone.
    let start = new Date(inventoriesRangeDate.split("/")[0]);
    let end = new Date(inventoriesRangeDate.split("/")[1]);

    // Set time to start of the day for startDate and end of the day for endDate
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    // just get basic information user visualisation, not the whole inventory
    // user will be able to click on the inventory to see the details
    const inventories = await Inventory.find({
      business: businessId,
      currentCountScheduleDate: { $gte: start, $lte: end },
    })
      .select("currentCountScheduleDate previewsCountedDate doneBy")
      .lean();

    return !inventories.length
      ? new NextResponse(JSON.stringify({ message: "No inventories found" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(inventories), { status: 200 });
  } catch (error: any) {
    return new NextResponse(JSON.stringify({ message: error.message }), {
      status: 500,
    });
  }
};
