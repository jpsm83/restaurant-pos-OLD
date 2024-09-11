import connectDb from "@/app/lib/utils/connectDb";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/salesLocation";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

// @desc    Create new tables
// @route   POST /tables/:tableId/closeTable
// @access  Private
export const POST = async (req: Request, context: { params: { tableId: Types.ObjectId } }) => {
  try {
    const { closedBy } = (await req.json()) as {
      closedBy: Types.ObjectId;
    };

    const tableId = context.params.tableId;

    // connect before first call to DB
    await connectDb();

    // get all orders from the table
    const tableOrders: ISalesLocation[] | null = await Order.find({ table: tableId })
      .select("billingStatus")
      .lean();

    // if no orders, delete the table
    if (!tableOrders || tableOrders?.length === 0) {
      await Table.deleteOne({ _id: tableId });
      return new NextResponse(
        JSON.stringify({
          message: "Table with no orders deleted successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if any order billingStatus is Open
    const hasOpenOrders = tableOrders.some(
      (order) => order.billingStatus === "Open"
    );

    // if no open orders and closeBy exists, close the table
    if (!hasOpenOrders && closedBy) {
      await Table.findByIdAndUpdate(
        tableId,
        {
          status: "Closed",
          closedAt: new Date(),
          closedBy,
        },
        { new: true }
      );
      return new NextResponse(
        JSON.stringify({ message: "Table closed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    return new NextResponse(
      JSON.stringify({
        message: "Table cant be closed because it still having open orders",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Close table failed!", error);
  }
};
