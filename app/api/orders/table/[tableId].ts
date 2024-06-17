import connectDB from "@/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Order from "@/lib/models/order";

// @desc    Get orders table ID
// @route   GET /orders/table/:tableId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const tableId = context.params.tableId;
    // check if tableId is valid
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const orders = await Order.find({ table: tableId })
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
