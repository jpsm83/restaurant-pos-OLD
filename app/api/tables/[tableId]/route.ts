import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ITable } from "@/app/lib/interface/ITable";

// import functions
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";
import { handleApiError } from "@/app/utils/handleApiError";

// import models
import Business from "@/app/lib/models/business";
import Table from "@/app/lib/models/table";
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// @desc    Get tables by ID
// @route   GET /tables/:tableId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { tableId: Types.ObjectId } }
) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse("Invalid tableId!", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.findById(tableId)
      // .populate("openedBy", "username currentShiftRole")
      // .populate("responsibleBy", "username currentShiftRole")
      // .populate("closedBy", "username currentShiftRole")
      // .populate({
      //   path: "orders",
      //   select:
      //     "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
      //   populate: {
      //     path: "businessGoods",
      //     select: "name category subCategory allergens sellingPrice",
      //   },
      // })
      .lean();

    return !tables
      ? new NextResponse("Table not found!", {
          status: 404,
        })
      : new NextResponse(JSON.stringify(tables), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get user by its id failed!", error);
  }
};

// @desc    Update tables
// @route   PATCH /tables/:tableId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { tableId: Types.ObjectId } }
) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse("Invalid tableId!", {
        status: 400,
      });
    }

    // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so user can see the total price, net price, net paid and tips in real time
    const { guests, status, responsibleBy, clientName, tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips, closedBy } =
      (await req.json()) as ITable;

    // connect before first call to DB
    await connectDB();

    // check if table exists
    const table: ITable | null = await Table.findById(tableId).lean();
    if (!table) {
      return new NextResponse("Table not found!", {
        status: 404,
      });
    }

    // get table orders
    const tableOrders = await Order.find({ table: tableId })
      .select("orderPrice orderNetPrice orderTips billingStatus")
      .lean();

    // prepare the tableObj to update
    let updatedTable = {
      guests: guests || table.guests,
      status: status || table.status,
      responsibleBy: responsibleBy || table.responsibleBy,
      clientName: clientName || table.clientName,
      tableTotalPrice: tableTotalPrice || table.tableTotalPrice,
      tableTotalNetPrice: tableTotalNetPrice || table.tableTotalNetPrice,
      tableTotalNetPaid: tableTotalNetPaid || table.tableTotalNetPaid,
      tableTotalTips: tableTotalTips || table.tableTotalTips,
    };

    // The order controller would handle the creation of orders and updating the relevant table's order array. The table controller would then only be responsible for reading and managing table data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // if table is transferred to another user, and that is the first table from the new user, update the dailySalesReport to create a new userDailySalesReport for the new user
    if (responsibleBy && responsibleBy !== table.openedBy) {
      // check if user exists in the dailySalesReport
      const userDailySalesReport = await DailySalesReport.findOne({
        dailyReportOpen: true,
        business: table.business,
        "usersDailySalesReport.user": responsibleBy,
      }).lean();

      // if user does not exist in the dailySalesReport, create it
      if (!userDailySalesReport) {
        await addUserToDailySalesReport(responsibleBy, table.business);
      }
    }

    // if table is occupied and no orders, delete the table
    if (
      table.status === "Occupied" &&
      (!table.orders || table.orders.length === 0)
    ) {
      await Table.deleteOne({ _id: tableId });
      return new NextResponse("Occupied table with no orders been deleted!", {
        status: 200,
      });
    }

    // save the updated table
    await Table.findOneAndUpdate({ _id: tableId }, updatedTable, {
      new: true,
    });

    return new NextResponse(
      `Table ${table.tableReference} updated successfully!`,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError("Update table failed!", error);
  }
};

// delete a table shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a table should be deleted is if the business itself is deleted
// or if the table was created by mistake and it has no orders
// @desc    Delete table
// @route   DELETE /table/:tableId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { tableId: Types.ObjectId } }
) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse("Invalid tableId", {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const table: ITable | null = await Table.findById(tableId).lean();

    if (!table) {
      return new NextResponse("Table not found!", {
        status: 404,
      });
    }

    // do not allow delete if table has orders
    if ((table?.orders ?? []).length > 0) {
      return new NextResponse("Cannot delete TABLE with orders!", {
        status: 400,
      });
    }

    // delete the table
    await Table.deleteOne({ _id: tableId });

    return new NextResponse(
      `Table ${table.tableReference} deleted successfully!`,
      { status: 200 }
    );
  } catch (error) {
    return handleApiError("Fail to delete table", error);
  }
};
