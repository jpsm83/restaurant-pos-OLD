import { IOrder } from "@/app/lib/interface/IOrder";
import { ITable } from "@/app/lib/interface/ITable";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import mongoose, { Types } from "mongoose";
import { createTable } from "../../tables/utils/createTable";

export const transferOrderBetweenTables = async (
  ordersArray: [Types.ObjectId],
  table: string,
  guests: number,
  user: Types.ObjectId,
  clientName: string | undefined | null,
  business: Types.ObjectId,
  dayReferenceNumber: number
) => {
  // validate array of orders IDs
  if (Array.isArray(ordersArray) && ordersArray.length > 0) {
    for (let order of ordersArray) {
      if (!Types.ObjectId.isValid(order)) {
        return "Invalid order ID!";
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
      tableReference: { $in: [table] },
      status: { $ne: "Closed" },
    })
      .select("_id")
      .lean();

    if (tableToTransfer) {
      tableToTransferId = tableToTransfer._id;
    } else {
      const newTable = (await createTable(
        table,
        guests,
        user,
        user,
        business,
        clientName,
        dayReferenceNumber
      )) as { message: string; tableId: any };
      if (!newTable.message) {
        return newTable;
      } else {
        tableToTransferId = newTable.tableId;
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

    return "Orders transferred successfully!";
  } else {
    return "Invalid array of orders!";
  }
};
