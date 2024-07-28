import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import models
import Table from "@/app/lib/models/table";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc   Get tables by user ID
// @route  GET /tables/user/:userId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;
    // validate userId
    if (!userId || !Types.ObjectId.isValid(userId)) {
      return new NextResponse(JSON.stringify({ message: "Invalid userId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.find({ responsibleBy: userId })
      // .populate("openedBy", "username currentShiftRole")
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

    return !tables.length
      ? new NextResponse(JSON.stringify({ message: "No tables found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(tables), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Fail to get all tables by user ID!", error);
  }
};
