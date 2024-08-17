import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import BusinessGood from "@/app/lib/models/businessGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get business goods by business ID
// @route   GET /businessGoods/business/:businessId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId; // Corrected to use route parameter

    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDB();

    const businessGoods = await BusinessGood.find({ business: businessId })
      .populate("ingredients.ingredient", "name mainCategory subCategory")
      .lean();

    return !businessGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No business goods found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(businessGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get business good by business id failed!", error);
  }
};
