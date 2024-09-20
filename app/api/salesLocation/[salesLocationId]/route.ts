import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";

// import interfaces
import { ISalesLocation } from "@/app/lib/interface/ISalesLocation";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesLocation from "@/app/lib/models/salesLocation";

// @desc    Get salesLocations by ID
// @route   GET /salesLocations/:salesLocationId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { salesLocationId: Types.ObjectId } }
) => {
  try {
    const salesLocationId = context.params.salesLocationId;

    // validate salesLocationId
    if (isObjectIdValid([salesLocationId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesLocationId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const salesLocations = await SalesLocation.findById(salesLocationId)
      .populate({
        path: "openedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "responsibleById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "closedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "ordersIds",
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

    return !salesLocations
      ? new NextResponse(
          JSON.stringify({ message: "SalesLocation not found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesLocations), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get user by its id failed!", error);
  }
};

// salesLocationReference and ordersIds doesnt get updated here, we got separate routes for that
// @desc    Update salesLocations
// @route   PATCH /salesLocations/:salesLocationId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesLocationId: Types.ObjectId } }
) => {
  try {
    const salesLocationId = context.params.salesLocationId;

    // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so user can see the total price, net price, net paid and tips in real time
    const { guests, status, responsibleById, clientName, closedById } =
      (await req.json()) as ISalesLocation;

    // Validate ObjectIds in one step for better performance
    const idsToValidate = [salesLocationId];
    if (responsibleById) idsToValidate.push(responsibleById);
    if (closedById) idsToValidate.push(closedById);

    // validate ids
    if (!isObjectIdValid(idsToValidate)) {
      return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    // get the salesLocation
    const salesLocation: ISalesLocation | null = await SalesLocation.findById(
      salesLocationId
    )
      .select("openedById businessId status ordersIds")
      .lean();

    if (!salesLocation) {
      return new NextResponse(
        JSON.stringify({ message: "SalesLocation not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle deletion for occupied salesLocation without orders
    if (
      salesLocation.status === "Occupied" &&
      (!salesLocation.ordersIds || salesLocation.ordersIds.length === 0)
    ) {
      await SalesLocation.deleteOne({ _id: salesLocationId });
      return new NextResponse(
        JSON.stringify({
          message: "Occupied salesLocation with no orders has been deleted!",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // prepare the tableObj to update
    let updatedSalesLocationObj: Partial<ISalesLocation> = {};

    if (guests) updatedSalesLocationObj.guests = guests;
    if (status) updatedSalesLocationObj.status = status;
    if (clientName) updatedSalesLocationObj.clientName = clientName;
    if (closedById) {
      updatedSalesLocationObj.closedById = closedById;
    }
    if (responsibleById) {
      updatedSalesLocationObj.responsibleById = responsibleById;
      // if salesLocation is transferred to another user, and that is the first salesLocation from the new user, update the dailySalesReport to create a new userDailySalesReport for the new user
      if (responsibleById !== salesLocation?.openedById) {
        // check if user exists in the dailySalesReport
        if (
          !(await DailySalesReport.findOne({
            isDailyReportOpen: true,
            business: salesLocation?.businessId,
            "usersDailySalesReport.userId": responsibleById,
          }).lean())
        ) {
          if (salesLocation?.businessId) {
            await addUserToDailySalesReport(
              responsibleById,
              salesLocation.businessId
            );
          }
        }
      }
    }

    // The order controller would handle the creation of orders and updating the relevant salesLocation's order array. The salesLocation controller would then only be responsible for reading and managing salesLocation data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // function closeOrders will automaticaly close the salesLocation once all OPEN orders are closed

    // save the updated salesLocation
    await SalesLocation.findOneAndUpdate(
      { _id: salesLocationId },
      { $set: updatedSalesLocationObj },
      { new: true }
    );

    return new NextResponse(
      JSON.stringify({
        message: "SalesLocation updated successfully!",
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
// @route   DELETE /salesLocation/:salesLocationId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { salesLocationId: Types.ObjectId } }
) => {
  try {
    const salesLocationId = context.params.salesLocationId;

    // validate salesLocationId
    if (isObjectIdValid([salesLocationId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesLocationId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // do not allow delete if salesLocation has orders
    // delete the salesLocation
    const result = await SalesLocation.deleteOne({
      _id: salesLocationId,
      ordersIds: {
        $or: [
          { ordersIds: { $size: 0 } },
          { ordersIds: { $exists: false } },
        ],
      },
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales location not found or it has orders!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales location deleted successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Fail to delete salesLocation", error);
  }
};
