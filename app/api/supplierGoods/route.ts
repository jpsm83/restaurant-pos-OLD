import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// imported interfaces
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const supplierGoods = await SupplierGood.find()
      .populate({ path: "supplier", select: "tradeName", model: Supplier })
      .lean();

    return !supplierGoods.length
      ? new NextResponse(
          JSON.stringify({ message: "No supplier goods found!!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGoods), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get all supplier goods failed!", error);
  }
};

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
      supplier,
      business,
      description,
      allergens,
      budgetImpact,
      image,
      saleUnit,
      wholeSalePrice,
      measurementUnit,
      totalQuantityPerUnit,
      parLevel,
      minimumQuantityRequired,
      inventorySchedule,
    } = (await req.json()) as ISupplierGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !mainCategory ||
      !subCategory ||
      currentlyInUse === undefined ||
      !supplier ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, subCategory, currentlyInUse, supplier and business are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if the supplier good already exists
    const duplicateSupplierGood = await SupplierGood.findOne({
      business,
      name,
    });

    if (duplicateSupplierGood) {
      return new NextResponse(
        JSON.stringify({
          message: `${name} already exists on supplier goods!`,
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Create a supplier good object with required fields
    const supplierGoodObj: ISupplierGood = {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
      supplier,
      business,
      description: description || undefined,
      allergens: allergens || undefined,
      budgetImpact: budgetImpact || undefined,
      image: image || undefined,
      saleUnit: saleUnit || undefined,
      wholeSalePrice: wholeSalePrice || undefined,
      measurementUnit: measurementUnit || undefined,
      totalQuantityPerUnit: totalQuantityPerUnit || undefined,
      pricePerUnit:
        wholeSalePrice && totalQuantityPerUnit
          ? wholeSalePrice / totalQuantityPerUnit
          : undefined,
      parLevel: parLevel || undefined,
      minimumQuantityRequired: minimumQuantityRequired || undefined,
      inventorySchedule: inventorySchedule || undefined,
    };

    // create a new supplier good
    await SupplierGood.create(supplierGoodObj);

    // confirm supplier good was created
    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${name} created successfully!`,
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Create supplier good failed!", error);
  }
};
