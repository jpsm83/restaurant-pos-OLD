import connectDB from "@/app/lib/db";
import { ITable } from "@/app/lib/interface/ITable";
import Order from "@/app/lib/models/order";
import Table from "@/app/lib/models/table";
import { Types } from "mongoose";

export const closeTable = async (
  tableId: Types.ObjectId,
  closedBy: Types.ObjectId
) => {
  try {
    // connect before first call to DB
    await connectDB();

    // get all orders from the table
    const tableOrders: ITable[] | null = await Order.find({ table: tableId })
      .select("billingStatus")
      .lean();

      // if no orders, delete the table
    if (!tableOrders || tableOrders?.length === 0) {
      await Table.deleteOne({ _id: tableId });
            return "Table with no orders deleted successfully";
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
      return "Table closed successfully";
    }
    return "Table cant be closed because it still having open orders";
  } catch (error) {
    return "Close table failed! " + error;
  }
};
