import connectDb from "@/app/lib/utils/connectDb";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import SalesLocation from "@/app/lib/models/salesLocation";
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

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
      return new NextResponse(JSON.stringify({ message: "Invalid tableId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const tables = await SalesLocation.findById(tableId)
      .populate({
        path: "openedBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "responsibleBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "closedBy",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "orders",
        select:
          "billingStatus orderStatus orderPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoods",
        populate: {
          path: "businessGoods",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      })
      .lean();

    return !tables
      ? new NextResponse(JSON.stringify({ message: "SalesLocation not found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
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
      return new NextResponse(JSON.stringify({ message: "Invalid tableId!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so user can see the total price, net price, net paid and tips in real time
    const {
      guests,
      status,
      responsibleBy,
      clientName,
      closedBy,
    } = (await req.json()) as ISalesLocation;

    // connect before first call to DB
    await connectDb();

    // check if salesLocation exists
    const salesLocation: ISalesLocation | null = await SalesLocation.findById(tableId).lean();
    if (!salesLocation) {
      return new NextResponse(JSON.stringify({ message: "SalesLocation not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // prepare the tableObj to update
    let updatedTable = {
      guests: guests || salesLocation.guests,
      status: status || salesLocation.status,
      responsibleBy: responsibleBy || salesLocation.responsibleBy,
      clientName: clientName || salesLocation.clientName,
    };

    // The order controller would handle the creation of orders and updating the relevant salesLocation's order array. The salesLocation controller would then only be responsible for reading and managing salesLocation data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // function closeOrders will automaticaly close the salesLocation once all OPEN orders are closed

    // if salesLocation is transferred to another user, and that is the first salesLocation from the new user, update the dailySalesReport to create a new userDailySalesReport for the new user
    if (responsibleBy && responsibleBy !== salesLocation.openedBy) {
      // check if user exists in the dailySalesReport
      const userDailySalesReport = await DailySalesReport.findOne({
        isDailyReportOpen: true,
        business: salesLocation.business,
        "usersDailySalesReport.user": responsibleBy,
      }).lean();

      // if user does not exist in the dailySalesReport, create it
      if (!userDailySalesReport) {
        await addUserToDailySalesReport(responsibleBy, salesLocation.business);
      }
    }

    // if salesLocation is occupied and no orders, delete the salesLocation
    if (
      salesLocation.status === "Occupied" &&
      (!salesLocation.orders || salesLocation.orders.length === 0)
    ) {
      await SalesLocation.deleteOne({ _id: tableId });
      return new NextResponse(
        JSON.stringify({
          message: "Occupied salesLocation with no orders been deleted!",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // save the updated salesLocation
    await SalesLocation.findOneAndUpdate({ _id: tableId }, updatedTable, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `SalesLocation ${salesLocation.salesLocationReference} updated successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Update salesLocation failed!", error);
  }
};

// delete a salesLocation shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a salesLocation should be deleted is if the business itself is deleted
// or if the salesLocation was created by mistake and it has no orders
// @desc    Delete salesLocation
// @route   DELETE /salesLocation/:tableId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { tableId: Types.ObjectId } }
) => {
  try {
    const tableId = context.params.tableId;
    // validate tableId
    if (!tableId || !Types.ObjectId.isValid(tableId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid tableId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    const salesLocation: ISalesLocation | null = await SalesLocation.findById(tableId).lean();

    if (!salesLocation) {
      return new NextResponse(JSON.stringify({ message: "SalesLocation not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // do not allow delete if salesLocation has orders
    if ((salesLocation?.orders ?? []).length > 0) {
      return new NextResponse(
        JSON.stringify({ message: "Cannot delete SALESLOCATION with orders!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // delete the salesLocation
    await SalesLocation.deleteOne({ _id: tableId });

    return new NextResponse(
      JSON.stringify({
        message: `SalesLocation ${salesLocation.salesLocationReference} deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Fail to delete salesLocation", error);
  }
};
