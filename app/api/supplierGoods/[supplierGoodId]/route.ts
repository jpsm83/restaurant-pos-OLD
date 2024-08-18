import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import { Types } from "mongoose";

// imported interfaces
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// import utils
import { handleApiError } from "@/app/lib/utils/handleApiError";

// import models
import SupplierGood from "@/app/lib/models/supplierGood";
import BusinessGood from "@/app/lib/models/businessGood";
import Supplier from "@/app/lib/models/supplier";

// @desc    Get supplier good by ID
// @route   GET /supplierGoods/:supplierGoodId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;
    // check if the supplier good is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const supplierGood = await SupplierGood.findById(supplierGoodId)
      .populate({ path: "supplier", select: "tradeName", model: Supplier })
      .lean();

    return !supplierGood
      ? new NextResponse(
          JSON.stringify({ message: "Supplier good not found!" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      : new NextResponse(JSON.stringify(supplierGood), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get supplier good by its id failed!", error);
  }
};

// @desc    Update supplier good by ID
// @route   PATCH /supplierGoods/:supplierGoodId
// @access  Private
export const PATCH = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;
    // check if supplierGoodId is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const {
      name,
      keyword,
      mainCategory,
      subCategory,
      currentlyInUse,
      supplier,
      description,
      allergens,
      budgetImpact,
      image,
      saleUnit,
      wholeSalePrice,
      measurementUnit,
      parLevel,
      minimumQuantityRequired,
      inventorySchedule,
      totalQuantityPerUnit,
      dynamicCountFromLastInventory,
    } = (await req.json()) as ISupplierGood;

    // connect before first call to DB
    await connectDB();

    // check if the supplier good exists
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    ).lean();
    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // check for duplicates supplier good name
    const duplicateSupplierGood = await SupplierGood.findOne({
      _id: { $ne: supplierGoodId },
      business: supplierGood.business,
      name,
      supplier,
    });

    if (duplicateSupplierGood) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier good ${name} already exists on this supplier!`,
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // prepare update object
    const updateObj: ISupplierGood = {
      name: name || supplierGood.name,
      keyword: keyword || supplierGood.keyword,
      mainCategory: mainCategory || supplierGood.mainCategory,
      subCategory: subCategory || supplierGood.subCategory,
      currentlyInUse: currentlyInUse || supplierGood.currentlyInUse,
      supplier: supplier || supplierGood.supplier,
      description: description || supplierGood.description,
      allergens: allergens || supplierGood.allergens,
      budgetImpact: budgetImpact || supplierGood.budgetImpact,
      image: image || supplierGood.image,
      saleUnit: saleUnit || supplierGood.saleUnit,
      wholeSalePrice: wholeSalePrice || supplierGood.wholeSalePrice,
      measurementUnit: measurementUnit || supplierGood.measurementUnit,
      totalQuantityPerUnit:
        totalQuantityPerUnit || supplierGood.totalQuantityPerUnit,
      pricePerUnit:
        wholeSalePrice && totalQuantityPerUnit
          ? wholeSalePrice / totalQuantityPerUnit
          : undefined,
      parLevel: parLevel || supplierGood.parLevel,
      minimumQuantityRequired:
        minimumQuantityRequired || supplierGood.minimumQuantityRequired,
      inventorySchedule: inventorySchedule || supplierGood.inventorySchedule,
      // IMPORTANT *** dynamicCountFromLastInventory is the start point of the inventory count
      // UPDATE BY ITSELF
      // Should be add upon creation of the supplier good if the business is wants to use the inventory module
      // Can be updated to a new value if the business didnt use the inventory module but decided to start using it
      // Not supose to be updated manualy unless is one of the cases above
      // UPDATED BY ORDER CONTROLLER
      // Its value will decrease base on the supplier good that orders are made from
      // it wont affect the inventory count till the inventory is counted
      // UPDATED BY INVENTORY CONTROLLER
      // Every time the inventory is counted, new value of supplierGood.dynamicCountFromLastInventory will be equatl to the current inventory.currentCountQuantity
      dynamicCountFromLastInventory:
        dynamicCountFromLastInventory ||
        supplierGood.dynamicCountFromLastInventory,
    };

    // updated supplier good
    await SupplierGood.findByIdAndUpdate(supplierGoodId, updateObj, {
      new: true,
    });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${name} updated successfully!`,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Update supplier good failed!", error);
  }
};

// delete a supplier goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier goods should be deleted is if the business itself is deleted
// but in case you want to delete a supplier good you can use the following code
// be aware that this will remove the supplier good from the database and all the business goods reference will be lost
// @desc    Delete supplier good by ID
// @route   DELETE /supplierGoods/:supplierGoodId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { supplierGoodId: Types.ObjectId } }
) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;
    // check if the supplier good is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    ).lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // give it a warning on the front application
    // make user delete the supplier good from all business goods before deleting it
    // thats way he will know that he need to replace the supplier good with another one for the business good be a valid one
    // check if the supplier good is used in any business goods
    const businessGoodsUsingSupplierGood = await BusinessGood.find({
      ingredients: { $elemMatch: { ingredient: supplierGoodId } },
    })
      .select("name")
      .lean();

    const supplierGoodBeenUsedMessage = `Supplier good ${
      supplierGood.name
    } is used in the following business goods: ${businessGoodsUsingSupplierGood
      .map((good) => good.name)
      .join(
        ", "
      )}. Please remove it from the business goods before deleting it!`;

    if (businessGoodsUsingSupplierGood.length) {
      return new NextResponse(
        JSON.stringify({ message: supplierGoodBeenUsedMessage }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier good
    await SupplierGood.deleteOne({ _id: supplierGoodId });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${supplierGood.name} deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete supplier good failed!", error);
  }
};
