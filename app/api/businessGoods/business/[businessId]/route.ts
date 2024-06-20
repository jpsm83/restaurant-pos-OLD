import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import BusinessGood from "@/app/lib/models/businessGood";

// @desc    Get business goods by business ID
// @route   GET /businessGoods/business/:businessId
// @access  Private
export const GET = async (context: {
  params: { businessId: Types.ObjectId };
}) => {
  try {
    const businessId = context.params.businessId; // Corrected to use route parameter

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        {
          status: 400,
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const businessGoods = await BusinessGood.find({ business: businessId })
      .populate("ingredients.ingredient", "name category")
      .lean();

    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No business goods found" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(businessGoods), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
