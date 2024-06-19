import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Table from "@/lib/models/table";

// @desc   Get tables by bussiness ID
// @route  GET /tables/business/:businessId
// @access Private
export const GET = async (context: { params: any }) => {
  try {
    const businessId = context.params.businessId;
    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.find({ business: businessId })
      .populate("openedBy", "username currentShiftRole")
      .populate("responsibleBy", "username currentShiftRole")
      .populate("closedBy", "username currentShiftRole")
      .populate({
        path: "orders",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
        populate: {
          path: "businessGoods",
          select: "name category subCategory allergens sellingPrice",
        },
      })
      .lean();

    return !tables.length
      ? new NextResponse(JSON.stringify({ message: "No tables found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(tables), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
