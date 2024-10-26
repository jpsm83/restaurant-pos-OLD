import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import models
import Order from "@/app/lib/models/order";
import SalesInstance from "@/app/lib/models/salesInstance";

// @desc    Create new tables
// @route   PATCH /salesInstance/:salesInstanceId/closeSalesInstance
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesInstanceId: Types.ObjectId } }
) => {
  const { closedById } = (await req.json()) as {
    closedById: Types.ObjectId;
  };

  const salesInstanceId = context.params.salesInstanceId;

  //validate ids
  if (isObjectIdValid([salesInstanceId, closedById]) !== true) {
    return new NextResponse(
      JSON.stringify({ message: "Invalid salesInstanceId or closedById!" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // connect before first call to DB
  await connectDb();

  // Start a session to handle transactions
  // with session if any error occurs, the transaction will be aborted
  // session is created outside of the try block to be able to abort it in the catch/finally block
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // check if salesInstance and open orders exists
    const [salesInstance, openOrders] = await Promise.all([
      SalesInstance.exists({
        _id: salesInstanceId,
        $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
      }),
      Order.exists({
        salesInstanceId: salesInstanceId,
        billingStatus: "Open",
      }),
    ]);

    // check if salesInstance has no salesGroup
    if (salesInstance) {
      const deletedSalesInstance = await SalesInstance.deleteOne(
        { _id: salesInstanceId },
        { new: true, session }
      );

      if (deletedSalesInstance.deletedCount === 0) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Sales instance not deleted!",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // if no open orders and closeBy exists, close the table
    if (!openOrders) {
      const updatedSalesInstance = await SalesInstance.updateOne(
        { _id: salesInstanceId },
        {
          status: "Closed",
          closedAt: new Date(),
          closedById,
        },
        { session }
      );

      if (updatedSalesInstance.modifiedCount === 0) {
        await session.abortTransaction();
        return new NextResponse(
          JSON.stringify({
            message: "Sales instance not closed!",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message: "Sales instance updated successfully!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    await session.abortTransaction();
    return handleApiError("Close table failed!", error);
  } finally {
    session.endSession();
  }
};
