import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// import models
import SupplierGood from "@/lib/models/supplierGood";
import { Types } from "mongoose";

// @desc    Get supplier goods by supplier ID
// @route   GET /supplierGoods/supplier/:supplierId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const supplierId = context.params.supplierId;
    // check if the supplier is valid
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const supplierGoods = await SupplierGood.find({
      supplier: supplierId,
    }).lean();

    return !supplierGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No supplier goods found!" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(supplierGoods), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
