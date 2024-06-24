import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/utils/handleApiError";

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
      return new NextResponse("Invalid supplierId!", { status: 400 });
    }

    // connect before first call to DB
    await connectDB();

    const supplierGoods = await SupplierGood.find({
      supplier: supplierId,
    }).lean();

    return !supplierGoods.length
      ? new NextResponse("No supplier goods found!", { status: 404 })
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get supplier good by supplier id failed!", error);
  }
};
