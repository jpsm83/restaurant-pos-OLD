import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// import models
import Supplier from "@/app/lib/models/supplier";

// @desc   Get supplier by business ID
// @route  GET /supplier/business/:businessId
// @access Private
export const getSupplierByBusinessId = async (context: { params: any }) => {
  try {
    const businessId = context.params.businessId;
    // validate businessId
    if (!businessId || !Types.ObjectId.isValid(businessId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid businessId" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const suppliers = await Supplier.find({ business: businessId })
      .populate("supplierGoods", "name category currentlyInUse")
      .lean();

    return !suppliers.length
      ? new NextResponse(JSON.stringify({ message: "No suppliers found!" }), {
          status: 404,
        })
      : new NextResponse(JSON.stringify(suppliers), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
