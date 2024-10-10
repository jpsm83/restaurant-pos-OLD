import connectDb from "@/app/lib/utils/connectDb";
import Order from "@/app/lib/models/order";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";
import SalesLocation from "@/app/lib/models/salesInstance";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Create new tables
// @route   PATCH /salesLocation/:salesLocationId/closeSalesLocation
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { salesLocationId: Types.ObjectId } }
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

    const salesLocationId = context.params.salesLocationId;

    //validate ids
    if (isObjectIdValid([salesLocationId, closedById]) !== true) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid salesLocationId or closedById!" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // check if sales location has no ordersIds
    if (
      await SalesLocation.exists({
        _id: salesLocationId,
        $or: [{ ordersIds: { $size: 0 } }, { ordersIds: { $exists: false } }],
      })
    ) {
      await SalesLocation.deleteOne(
        { _id: salesLocationId },
        { new: true, session }
      );
      return new NextResponse(
        JSON.stringify({
          message: "Sales location with no orders deleted successfully",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if any open orders exist for the sales location
    const hasOpenOrders = await Order.exists({
      salesLocationId: salesLocationId,
      billingStatus: "Open",
    });

    // if no open orders and closeBy exists, close the table
    if (!hasOpenOrders) {
      await SalesLocation.findByIdAndUpdate(
        salesLocationId,
        {
          status: "Closed",
          closedAt: new Date(),
          closedById,
        },
        { new: true, session }
      );

      return new NextResponse(
        JSON.stringify({ message: "Sales location closed successfully" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Commit the transaction if both operations succeed
    await session.commitTransaction();
    session.endSession();

    return new NextResponse(
      JSON.stringify({
        message:
          "Sales location cant be closed because it still having open orders",
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
