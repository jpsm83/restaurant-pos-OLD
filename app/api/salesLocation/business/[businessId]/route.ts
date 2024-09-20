import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// import models
import SalesLocation from "@/app/lib/models/salesLocation";
import Order from "@/app/lib/models/order";
import BusinessGood from "@/app/lib/models/businessGood";
import User from "@/app/lib/models/user";

// @desc   Get salesLocations by bussiness ID
// @route  GET /salesLocations/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;

    // validate salesLocationId
    if (isObjectIdValid([businessId]) !== true) {
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

    const salesLocations = await SalesLocation.find({ businessId: businessId })
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

    return !salesLocations.length
      ? new NextResponse(
          JSON.stringify({ message: "No salesLocations found!" }),
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
    return handleApiError(
      "Fail to get all salesLocations by business ID!",
      error
    );
  }
};
