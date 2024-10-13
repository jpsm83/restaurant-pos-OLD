import { NextResponse } from "next/server";
import { Types } from "mongoose";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces

// imported models
import Order from "@/app/lib/models/order";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import SalesPoint from "@/app/lib/models/salesPoint";
import SalesInstance from "@/app/lib/models/salesInstance";

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
    if (isObjectIdValid([userId]) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const orders = await Order.find({ userId: userId })
      .populate({
        path: "salesInstanceId",
        select: "salesPointId",
        populate: {
          path: "salesPointId",
          select: "salesPointName",
          model: SalesPoint,
        },
        model: SalesInstance,
      })
      .populate({
        path: "userId",
        select: "username allUserRoles currentShiftRole",
        model: User,
      })
      .populate({
        path: "businessGoodsIds",
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
