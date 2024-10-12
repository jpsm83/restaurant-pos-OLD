import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { addUserToDailySalesReport } from "../../dailySalesReports/utils/addUserToDailySalesReport";

// import interfaces
import { ISalesInstance } from "@/app/lib/interface/ISalesInstance";

// import models
import DailySalesReport from "@/app/lib/models/dailySalesReport";
import User from "@/app/lib/models/user";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc    Get salesInstances by ID
// @route   GET /salesInstances/:salesInstanceId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  try {
    const salesInstanceId = context.params.salesInstanceId;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesInstanceId!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    const salesInstance = await SalesInstance.find()
      .populate({
        path: "salesPointId",
        select: "salesPointName salesPointType selfOrdering",
        model: SalesPoint,
      })
      .populate({
        path: "openedById responsibleById closedById",
        select: "username currentShiftRole",
        model: User,
      })
      .populate({
        path: "salesGroup.ordersIds",
        select:
          "billingStatus orderStatus orderGrossPrice orderNetPrice paymentMethod allergens promotionApplyed discountPercentage createdAt businessGoodsIds",
        populate: {
          path: "businessGoodsIds",
          select: "name mainCategory subCategory allergens sellingPrice",
          model: BusinessGood,
        },
        model: Order,
      })
      .lean();

    return !salesInstance
      ? new NextResponse(
          JSON.stringify({ message: "SalesLocation not found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstance), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get user by its id failed!", error);
  }
};

// salesPointId and salesGroup doesnt get updated here, we got separate routes for that
// also sales instance doesnt get closed here, they get closed when all orders are closed automatically
// @desc    Update salesInstances
// @route   PATCH /salesInstances/:salesInstanceId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const salesInstanceId = context.params.salesInstanceId;

    // calculation of the tableTotalPrice, tableTotalNetPrice, tableTotalNetPaid, tableTotalTips should be done on the front end so user can see the total price, net price, net paid and tips in real time
    const { guests, status, responsibleById, clientName } =
      (await req.json()) as ISalesInstance;

    // Validate ObjectIds in one step for better performance
    const idsToValidate = [salesInstanceId];
    if (responsibleById) idsToValidate.push(responsibleById);

    // validate ids
    if (isObjectIdValid(idsToValidate) !== true) {
      return new NextResponse(JSON.stringify({ message: "Invalid IDs!" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDb();

    // get the salesInstance
    const salesInstance: ISalesInstance | null = await SalesInstance.findById(
      salesInstanceId
    )
      .select("openedById businessId status salesGroup")
      .lean();

    if (!salesInstance) {
      return new NextResponse(
        JSON.stringify({ message: "SalesInstance not found!" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Handle deletion for occupied salesInstance without salesGroup
    if (
      salesInstance.status === "Occupied" &&
      (!salesInstance.salesGroup || salesInstance.salesGroup.length === 0) &&
      status !== "Reserved"
    ) {
      await SalesInstance.deleteOne(
        { _id: salesInstanceId },
        { new: true, session }
      );
      return new NextResponse(
        JSON.stringify({
          message: "Occupied salesInstance with no salesGroup has been deleted!",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // prepare the tableObj to update
    let updatedSalesInstanceObj: Partial<ISalesInstance> = {};

    if (guests) updatedSalesInstanceObj.guests = guests;
    if (status) updatedSalesInstanceObj.status = status;
    if (clientName) updatedSalesInstanceObj.clientName = clientName;
    if (responsibleById) {
      updatedSalesInstanceObj.responsibleById = responsibleById;
      // if salesInstance is transferred to another user, and that is the first salesInstance from the new user, update the dailySalesReport to create a new userDailySalesReport for the new user
      if (responsibleById !== salesInstance?.openedById) {
        // check if user exists in the dailySalesReport
        if (
          !(await DailySalesReport.exists({
            isDailyReportOpen: true,
            business: salesInstance?.businessId,
            "usersDailySalesReport.userId": responsibleById,
          }))
        ) {
          await addUserToDailySalesReport(
            responsibleById,
            salesInstance.businessId
          );
        }
      }
    }

    // The order controller would handle the creation of orders and updating the relevant salesInstance's order array. The salesInstance controller would then only be responsible for reading and managing salesInstance data, not order data. This separation of concerns makes the code easier to maintain and understand.

    // function closeOrders will automaticaly close the salesInstance once all OPEN orders are closed

    // save the updated salesInstance
    await SalesInstance.findOneAndUpdate(
      { _id: salesInstanceId },
      { $set: updatedSalesInstanceObj },
      { new: true, session }
    );

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "SalesInstance updated successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Update salesInstance failed!", error);
  } finally {
    session.endSession();
  }
};

// delete a salesInstance shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a salesInstance should be deleted is if the business itself is deleted or if the salesInstance was created by mistake and it has no orders
// @desc    Delete salesInstance
// @route   DELETE /salesInstance/:salesInstanceId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  try {
    const salesInstanceId = context.params.salesInstanceId;

    // validate salesInstanceId
    if (isObjectIdValid([salesInstanceId]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesInstanceId" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // do not allow delete if salesInstance has salesGroup
    // delete the salesInstance
    const result = await SalesInstance.deleteOne({
      _id: salesInstanceId,
      $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({
          message: "Sales instance not found or it has orders!",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(
      JSON.stringify({
        message: "Sales instance deleted successfully!",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Fail to delete salesInstance", error);
  }
};
