import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";

// @desc    Get supplier goods by supplier ID
// @route   GET /supplierGoods/supplier/:supplierId
// @access  Private
export const GET = async (
  req: Request,
  context: {
    params: { supplierId: Types.ObjectId };
  }
) => {
  try {
    const supplierId = context.params.supplierId;
    // check if the supplier is valid
    if (!supplierId || !Types.ObjectId.isValid(supplierId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
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
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get supplier good by supplier id failed!", error);
  }
};
