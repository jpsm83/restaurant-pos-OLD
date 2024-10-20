import connectDb from "@/app/lib/utils/connectDb";
import Order from "@/app/lib/models/order";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";
import SalesInstance from "@/app/lib/models/salesInstance";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Create new tables
// @route   PATCH /salesInstance/:salesInstanceId/closeSalesInstance
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

  if (!session) {
    return new NextResponse(
      JSON.stringify({ message: "Failed to start session for transaction" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  try {
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

    // check if salesInstance has no salesGroup
    if (
      await SalesInstance.exists({
        _id: salesInstanceId,
        $or: [{ salesGroup: { $size: 0 } }, { salesGroup: { $exists: false } }],
      })
    ) {
      await SalesInstance.deleteOne(
        { _id: salesInstanceId },
        { new: true, session }
      );
      return new NextResponse(
        JSON.stringify({
          message: "Sales instance with no orders deleted successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if any open orders exist for the sales instance
    const hasOpenOrders = await Order.exists({
      salesInstanceId: salesInstanceId,
      billingStatus: "Open",
    });

    // if no open orders and closeBy exists, close the table
    if (!hasOpenOrders) {
      await SalesInstance.updateOne(
        { _id: salesInstanceId },
        {
          status: "Closed",
          closedAt: new Date(),
          closedById,
        },
        { session }
      );

      return new NextResponse(
        JSON.stringify({ message: "Sales instance closed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();

    return new NextResponse(
      JSON.stringify({
        message:
          "Sales instance cant be closed because it still having open orders",
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
