import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Order from "@/app/lib/models/order";

// @desc    Get orders user ID
// @route   GET /orders/user/:userId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const userId = context.params.userId;
    // check if userId is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const orders = await Order.find({ user: userId })
      .populate("table", "tableReferenceNumber dayReferenceNumber")
      .populate("user", "username allUserRoles currentShiftRole")
      .populate(
        "businessGoods",
        "name category subCategory productionTime sellingPrice allergens"
      )
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(orders), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
