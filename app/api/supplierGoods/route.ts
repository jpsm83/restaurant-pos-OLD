import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDB();

    const supplierGoods = await SupplierGood.find()
      .populate("supplier", "tradeName")
      .lean();

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

// @desc    Create new supplier good
// @route   POST /supplierGoods
// @access  Private
export const POST = async (req: Request) => {
  try {
    const {
      name,
      keyword,
      category,
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
      dynamicCountFromLastInventory,
    } = req.body as unknown as ISupplierGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !category ||
      !subCategory ||
      currentlyInUse === undefined ||
      !supplier ||
      !business
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, category, subCategory, currentlyInUse, supplier and business are required!",
        }),
        { status: 400 }
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
        { status: 400 }
      );
    }

    // Create a supplier good object with required fields
    const supplierGoodObj: ISupplierGood = {
      name,
      keyword,
      category,
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
      // upon creation, the dynamicCountFromLastInventory is the current quantity purchased from the supplier
      // its required if business is to start using the inventory module
      // IMPORTANT *** THAT NUMBER IS THE START POINT FOR THE INVENTORY COUNT
      dynamicCountFromLastInventory: dynamicCountFromLastInventory || undefined,
    };

    // create a new supplier good
    const supplierGood = await SupplierGood.create(supplierGoodObj);

    // confirm supplier good was created
    return supplierGood
      ? new NextResponse(
          JSON.stringify({
            message: `Supplier good ${name} created successfully!`,
          }),
          { status: 201 }
        )
      : new NextResponse(
          JSON.stringify({ message: "Failed to create supplier good!" }),
          { status: 500 }
        );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
