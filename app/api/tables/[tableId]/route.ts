import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ITable } from "@/app/lib/interface/ITable";

// import functions
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";

// import models
import Business from "@/app/lib/models/business";
import Table from "@/app/lib/models/table";
import Order from "@/app/lib/models/order";
import DailySalesReport from "@/app/lib/models/dailySalesReport";

// @desc    Get tables by ID
// @route   GET /tables/:tableId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.findById(tableId)
      .populate("openedBy", "username currentShiftRole")
      .populate("responsibleBy", "username currentShiftRole")
      .populate("closedBy", "username currentShiftRole")
      .populate({
        path: "orders",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt",
        populate: {
          path: "businessGoods",
          select: "name category subCategory allergens sellingPrice",
        },
      })
      .lean();

    return !tables
      ? new NextResponse(JSON.stringify({ message: "Table not found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(tables), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update tables
// @route   PATCH /tables/:tableId
// @access  Private
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
      });
    }

    const {
      tableReference,
      guests,
      status,
      responsibleBy,
      clientName,
      tableTotalPrice,
      tableTotalNetPaid,
      tableTotalTips,
      orders,
      closedBy,
    } = req.body as unknown as ITable;

    // connect before first call to DB
    await connectDB();

    // check if table exists
    const table: ITable | null = await Table.findById(tableId).lean();
    if (!table) {
      return new NextResponse(JSON.stringify({ message: "Table not found!" }), {
        status: 404,
      });
    }

    // prepare the tableObj to update
    let updateObj = {
      guests: guests || table.guests,
      status: status || table.status,
      responsibleBy: responsibleBy || table.responsibleBy,
      clientName: clientName || table.clientName,
      tableTotalPrice: tableTotalPrice || table.tableTotalPrice,
      tableTotalNetPaid: tableTotalNetPaid || table.tableTotalNetPaid,
      tableTotalTips: tableTotalTips || table.tableTotalTips,
      closedAt: undefined as Date | undefined,
      closedBy: closedBy || table.closedBy,
    };

    // check if tableReference exists in the business
    if (tableReference) {
      const validateTableReference = await Business.findOne({
        _id: table.business,
        businessTables: { $in: [tableReference] },
      });

      // check if tableReference exists in the business (pre set tables that can be used)
      if (!validateTableReference) {
        return new NextResponse(
          JSON.stringify({
            message: "TableReference does not exist in this business!",
          }),
          { status: 400 }
        );
      }
    }

    // check for duplicates open table at the same day
    const duplicateTable = await Table.findOne({
      _id: { $ne: tableId },
      dayReferenceNumber: table.dayReferenceNumber,
      business: table.business,
      tableReference,
      status: { $ne: "Closed" },
    }).lean();
    if (duplicateTable) {
      return new NextResponse(
        JSON.stringify({
          message: `Table ${tableReference} already exists and it is not closed!`,
        }),
        { status: 409 }
      );
    }

    // The order controller would handle the creation of orders and updating the relevant table's order array. The table controller would then only be responsible for reading and managing table data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // if table is transferred to another user, update the dailySalesReport
    if (responsibleBy && responsibleBy !== table.openedBy) {
      // check if user exists in the dailySalesReport
      const userDailySalesReport = await DailySalesReport.findOne({
        dayReferenceNumber: table.dayReferenceNumber,
        business: table.business,
        "userDailySalesReportArray.user": responsibleBy,
      }).lean();

      // if user does not exist in the dailySalesReport, create it
      if (!userDailySalesReport) {
        await addUserToDailySalesReport(
          responsibleBy,
          table.dayReferenceNumber as number,
          table.business
        );
      }
    }

    // if no open orders and closeBy exists, close the table
    if (table.orders && table.orders.length > 0) {
      const openOrders = await Order.find({
        table: tableId,
        billingStatus: "Open",
      }).lean();
      if (openOrders.length === 0) {
        if (closedBy) {
          updateObj.status = "Closed";
          updateObj.closedAt = new Date();
          updateObj.closedBy = closedBy;
        } else {
          return new NextResponse(
            JSON.stringify({
              message: "Closed by is required to close a Table!",
            }),
            { status: 400 }
          );
        }
      }

      // if table is occupied and no orders, delete the table
      if (table.status === "Occupied" && !orders) {
        await Table.deleteOne();
        return new NextResponse(
          JSON.stringify({
            message: "Occupied table with no orders been deleted!",
          }),
          { status: 200 }
        );
      }

      // save the updated table
      await Table.findOneAndUpdate({ _id: tableId }, updateObj, {
        new: true,
        useFindAndModify: false,
      });

      return new NextResponse(
        JSON.stringify({
          message: `Table ${tableReference} updated successfully!`,
        }),
        { status: 200 }
      );
    }
  } catch (error: any) {
    return new NextResponse("Table update failed - Error: " + error, {
      status: 500,
    });
  }
};

// delete a table shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a table should be deleted is if the business itself is deleted
// or if the table was created by mistake and it has no orders
// @desc    Delete table
// @route   DELETE /table/:tableId
// @access  Private
export const DELETE = async (context: { params: any }) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
      });
    }

    // connect before first call to DB
    await connectDB();

    const table: ITable | null = await Table.findById(tableId).lean();

    if (!table) {
      return new NextResponse(JSON.stringify({ message: "Table not found!" }), {
        status: 404,
      });
    }

    // do not allow delete if table has open orders
    if (table.orders && table.orders.length > 0) {
      const orders = await Order.find({ _id: { $in: table.orders } }).lean();
      const hasOpenOrders = orders.some(
        (order) => order.billingStatus === "Open"
      );

      if (hasOpenOrders) {
        return new NextResponse(
          JSON.stringify({ message: "Cannot delete TABLE with open orders!" }),
          { status: 400 }
        );
      }
    }

    // delete the table
    await Table.deleteOne({ _id: tableId });

    return new NextResponse(
      JSON.stringify({
        message: `Table ${table.tableReference} deleted successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Fail to delete table - Error: " + error, {
      status: 500,
    });
  }
};
