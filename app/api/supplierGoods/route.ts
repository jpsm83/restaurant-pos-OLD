import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";

// imported interfaces
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import Supplier from "@/app/lib/models/supplier";
import addSupplierGoodToInventory from "../inventories/utils/addSupplierGoodToInventory";

// @desc    Get all supplier goods
// @route   GET /supplierGoods
// @access  Private
export const GET = async () => {
  try {
    // connect before first call to DB
    await connectDb();

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
      saleUnit,
      measurementUnit,
      parLevel,
      minimumQuantityRequired,
      inventorySchedule,
      pricePerUnit,
    } = (await req.json()) as ISupplierGood;

    // check required fields
    if (
      !name ||
      !keyword ||
      !mainCategory ||
      !subCategory ||
      currentlyInUse === undefined ||
      !supplier ||
      !business ||
      !pricePerUnit
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Name, keyword, mainCategory, subCategory, currentlyInUse, supplier, business and pricePerUnit are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

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
      saleUnit: saleUnit || undefined,
      measurementUnit: measurementUnit || undefined,
      pricePerUnit,
      parLevel: parLevel || undefined,
      minimumQuantityRequired: minimumQuantityRequired || undefined,
      inventorySchedule: inventorySchedule || undefined,
    };

    // create a new supplier good
    const newSupplierGood = await SupplierGood.create(supplierGoodObj);

    // *** IMPORTANT ***
    // when supplier good is created, it will be added to the inventory
    await addSupplierGoodToInventory(newSupplierGood._id, business);

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
