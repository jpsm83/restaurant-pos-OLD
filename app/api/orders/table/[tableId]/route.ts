import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Order from "@/app/lib/models/order";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get orders table ID
// @route   GET /orders/table/:tableId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { tableId: Types.ObjectId };
  }
) => {
  try {
    const tableId = context.params.tableId;
    // check if tableId is valid
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDB();

    const orders = await Order.find({ table: tableId })
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
    return handleApiError("Get all orders by table ID failed!", error);
  }
};
