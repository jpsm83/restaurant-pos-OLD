import { IOrder } from "@/app/lib/interface/IOrder";
import { ITable } from "@/app/lib/interface/ITable";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import { Types } from "mongoose";
import { createTable } from "../../tables/utils/createTable";
import { NextResponse } from "next/server";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Create new orders
// @route   POST /orders/actions
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      ordersArray,
      tableReference,
      guests,
      user,
      clientName,
      business,
      dayReferenceNumber,
    } = (await req.json()) as {
      ordersArray: Types.ObjectId[];
      tableReference: string;
      guests: number;
      user: Types.ObjectId;
      clientName: string | undefined | null;
      business: Types.ObjectId;
      dayReferenceNumber: number;
    };
    // validate array of orders IDs
    if (!Array.isArray(ordersArray) || ordersArray.length === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid array of orders!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
    for (let order of ordersArray) {
      if (!Types.ObjectId.isValid(order)) {
        new NextResponse(JSON.stringify({ message: "Invalid order ID!" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    const originalTable: IOrder | null = await Order.findOne({
      _id: ordersArray[0],
    })
      .select("table")
      .lean();

    let tableToTransferId;

    // we transfer tables following its tableReference because table might not exist yet
    // check if tables exist and it is not closed
    const tableToTransfer: ITable | null = await Table.findOne({
      dayReferenceNumber: dayReferenceNumber,
      business,
      tableReference: tableReference,
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

    if (tableToTransfer) {
      tableToTransferId = tableToTransfer._id;
    } else {
      const newTable = await createTable(
        tableReference,
        guests,
        user,
        user,
        business,
        clientName,
        dayReferenceNumber
      );
      if (!newTable) {
        return new NextResponse(
          JSON.stringify({ message: "Table creation for transfer failed!" }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      } else {
        tableToTransferId = newTable._id;
      }
    }

    // replace the table in each order
    for (let order of ordersArray) {
      await Order.findOneAndUpdate(
        { _id: order },
        { table: tableToTransferId },
        { new: true }
      );
    }

    // move orders between tables
    // Update the table document by adding the order id to it
    await Table.findOneAndUpdate(
      { _id: tableToTransferId },
      { $push: { orders: { $each: ordersArray } } },
      { new: true }
    );

    // Remove the order id from the old table
    await Table.findOneAndUpdate(
      { _id: originalTable?.table },
      { $pull: { orders: { $in: ordersArray } } },
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({ message: "Orders transferred successfully!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Transfer orders between tables failed!", error);
  }
};
