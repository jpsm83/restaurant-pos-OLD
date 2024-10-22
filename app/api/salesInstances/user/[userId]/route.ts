import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";
import connectDb from "@/app/lib/utils/connectDb";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import models
import SalesInstance from "@/app/lib/models/salesInstance";
import User from "@/app/lib/models/employee";
import BusinessGood from "@/app/lib/models/businessGood";
import Order from "@/app/lib/models/order";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc   Get salesInstances by user ID
// @route  GET /salesInstances/user/:userId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { userId: Types.ObjectId } }
) => {
  try {
    const userId = context.params.userId;

    // validate salesInstanceId
    if (isObjectIdValid([userId]) !== true) {
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

    const salesInstances = await SalesInstance.find()
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

    return !salesInstances.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesInstances found!" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        )
      : new NextResponse(JSON.stringify(salesInstances), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Fail to get all salesInstances by user ID!", error);
  }
};
