import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/salesLocation";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";

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
    await connectDb();

    const orders = await Order.find({ user: userId })
    .populate({ path: "table", select: "salesLocationReference", model: Table })
    .populate({
      path: "user",
      select: "username allUserRoles currentShiftRole",
      model: User,
    })
    .populate({
      path: "businessGoods",
      select:
        "name mainCategory subCategory productionTime sellingPrice allergens",
      model: BusinessGood,
    })
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
