import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// import models
import Inventory from "@/lib/models/inventory";
import { Types } from "mongoose";

// @desc    Get inventories by business ID
// @route   GET /inventories/business/:businessId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    // connect before first call to DB
    await connectDB();

    const businessId = context.params.id;
    // check if the businessId is valid
    if (!Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid notification ID" }),
        { status: 400 }
      );
    }

    // just get basic information user visualisation, not the whole inventory
    // user will be able to click on the inventory to see the details
    const inventories = await Inventory.find({ business: businessId })
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
