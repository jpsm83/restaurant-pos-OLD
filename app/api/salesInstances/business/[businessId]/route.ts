import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import models
import SalesInstance from "@/app/lib/models/salesInstance";
import Order from "@/app/lib/models/order";
import BusinessGood from "@/app/lib/models/businessGood";
import User from "@/app/lib/models/employee";
import SalesPoint from "@/app/lib/models/salesPoint";

// @desc   Get salesInstances by bussiness ID
// @route  GET /salesInstances/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    // validate salesInstanceId
    if (isObjectIdValid([businessId]) !== true) {
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
    return handleApiError(
      "Fail to get all salesInstances by business ID!",
      error
    );
  }
};
