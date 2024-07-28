import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Order from "@/app/lib/models/order";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get orders user ID
// @route   GET /orders/user/:userId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { userId: Types.ObjectId };
  }
) => {
  try {
    const userId = context.params.userId;
    // check if userId is valid
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDB();

    const orders = await Order.find({ user: userId })
      .populate("table", "tableReference")
      // .populate("user", "username allUserRoles currentShiftRole")
      .populate(
        "businessGoods",
        "name category subCategory productionTime sellingPrice allergens"
      )
      .lean();

    return !orders.length
      ? new NextResponse(JSON.stringify({ message: "No orders found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all orders by user ID failed!", error);
  }
};
