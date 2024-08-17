import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// import models
import Supplier from "@/app/lib/models/supplier";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc   Get supplier by business ID
// @route  GET /supplier/business/:businessId
// @access Private
export const GET = async (
  req: Request,
  context: {
    params: { businessId: Types.ObjectId };
  }
) => {
  try {
    const businessId = context.params.businessId;
    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const suppliers = await Supplier.find({ business: businessId })
      .populate("supplierGoods", "name mainCategory subCategory currentlyInUse")
      .lean();

    return !suppliers.length
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(suppliers), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        });
  } catch (error) {
    return handleApiError("Get suppliers by business id failed!", error);
  }
};
