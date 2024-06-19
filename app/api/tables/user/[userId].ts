import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Table from "@/lib/models/table";

// @desc   Get tables by user ID
// @route  GET /tables/user/:userId
// @access Private
export const GET = async (context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.find({ responsibleBy: userId })
      .populate("openedBy", "username currentShiftRole")
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
