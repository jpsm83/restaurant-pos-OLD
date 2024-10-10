import { IOrder } from "@/app/lib/interface/IOrder";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/salesInstance";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";
import { createSalesInstance } from "../../salesInstances/utils/createSalesInstance";
import connectDb from "@/app/lib/utils/connectDb";

// @desc    Create new orders
// @route   POST /orders/transferOrderBetweenTables
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      ordersArray,
      salesInstance,
      guests,
      user,
      clientName,
      business,
      dailyReferenceNumber,
    } = (await req.json()) as {
      ordersArray: Types.ObjectId[];
      salesInstance: string;
      guests: number;
      user: Types.ObjectId;
      clientName: string | undefined | null;
      business: Types.ObjectId;
      dailyReferenceNumber: number;
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

        // connect before first call to DB
        await connectDb();

    
    // we transfer tables following its salesInstance because table might not exist yet
    // check if tables exist and it is not closed
    const tableToTransfer: ISalesInstance | null = await Table.findOne({
      dailyReferenceNumber: dailyReferenceNumber,
      business,
      salesInstance: salesInstance,
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

         // create new salesInstance
    const salesInstanceObj = {
      dailyReferenceNumber,
      salesInstanceReferenceId,
      guests,
      status: status || "Occupied",
      openedById,
      responsibleById: openedById,
      businessId,
      clientName,
    };

    if (tableToTransfer) {
      tableToTransferId = tableToTransfer._id;
    } else {
      const newTable = await createSalesInstance(salesInstanceObj);
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
      {
        $push: { orders: { $each: ordersArray } },
        $set: { status: "Occupied" },
      },
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
