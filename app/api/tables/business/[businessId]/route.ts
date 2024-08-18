import connectDB from "@/app/lib/db";
import { NextResponse } from "next/server";
import { Types } from "mongoose";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import Table from "@/app/lib/models/table";
import Order from "@/app/lib/models/order";
import BusinessGood from "@/app/lib/models/businessGood";
import User from "@/app/lib/models/user";

// @desc   Get tables by bussiness ID
// @route  GET /tables/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: { params: { businessId: Types.ObjectId } }
) => {
  try {
    const businessId = context.params.businessId;
    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const tables = await Table.find({ business: businessId })
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
    return handleApiError("Fail to get all tables by business ID!", error);
  }
};
