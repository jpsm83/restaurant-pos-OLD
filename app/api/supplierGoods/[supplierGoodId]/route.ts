import { NextResponse } from "next/server";
import connectDB from "@/lib/db";

// import models
import SupplierGood from "@/lib/models/supplierGood";
import BusinessGood from "@/lib/models/businessGood";
import Inventory from "@/lib/models/inventory";
import { Types } from "mongoose";
import { ISupplierGood } from "@/app/interface/ISupplierGood";

// @desc    Get supplier good by ID
// @route   GET /supplierGoods/:supplierGoodId
// @access  Private
export const GET = async (context: { params: any }) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;
    // check if the supplier good is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId" }),
        { status: 400 }
      );
    }

    // connect before first call to DB
    await connectDB();

    const supplierGood = await SupplierGood.findById(supplierGoodId)
      .populate("supplier", "tradeName")
      .lean();

    return !supplierGood
      ? new NextResponse(
          JSON.stringify({ message: "Supplier good not found!" }),
          { status: 404 }
        )
      : new NextResponse(JSON.stringify(supplierGood), { status: 200 });
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};

// @desc    Update supplier good by ID
// @route   PATCH /supplierGoods/:supplierGoodId
// @access  Private
export const PATCH = async (req: Request, context: { params: any }) => {
  try {
    const supplierGoodId = context.params.supplierGoodId;
    // check if supplierGoodId is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId" }),
        { status: 400 }
      );
    }

    const {
      name,
      keyword,
      category,
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
    } = req.body as unknown as ISupplierGood;

    // connect before first call to DB
    await connectDB();

    // check if the supplier good exists
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    ).lean();
    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404 }
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
        { status: 409 }
      );
    }

    // prepare update object
    const updateObj: ISupplierGood = {
      name: name || supplierGood.name,
      keyword: keyword || supplierGood.keyword,
      category: category || supplierGood.category,
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
    await SupplierGood.findByIdAndUpdate({ _id: supplierGoodId }, updateObj, {
      new: true,
      usefindAndModify: false,
    }).lean();

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${name} updated successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Updated supplier good fail - Error: " + error, {
      status: 500,
    });
  }
};

// delete a supplier goods shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where a supplier goods should be deleted is if the business itself is deleted
// but in case you want to delete a supplier good you can use the following code
// be aware that this will remove the supplier good from the database and all the business goods reference will be lost
// @desc    Delete supplier good by ID
// @route   DELETE /supplierGoods/:supplierGoodId
// @access  Private
export const DELETE = async (contect: { params: any }) => {
  try {
    const supplierGoodId = contect.params.supplierGoodId;
    // check if the supplier good is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplierGoodId" }),
        { status: 400 }
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
        { status: 404 }
      );
    }

    // check if the supplier good is used in any business goods
    const businessGoodsUsingSupplierGood = await BusinessGood.find({
      ingredients: { $elemMatch: { ingredient: supplierGoodId } },
    })
      .select("name")
      .lean();

    if (businessGoodsUsingSupplierGood.length) {
      return new NextResponse(
        JSON.stringify({
          message: `Supplier good ${
            supplierGood.name
          } is used in the following business goods: ${businessGoodsUsingSupplierGood
            .map((good) => good.name)
            .join(
              ", "
            )}. Please remove it from the business goods before deleting it!`,
        }),
        { status: 409 }
      );
    }

    // remove the supplier good property from all inventory goods
    await Inventory.updateMany(
      { "inventoryGoods.supplierGood": supplierGoodId },
      { $unset: { "inventoryGoods.$.supplierGood": "" } }
    );

    // delete the supplier good
    await SupplierGood.deleteOne({ _id: supplierGoodId });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good ${supplierGood.name} deleted successfully!`,
      }),
      { status: 200 }
    );
  } catch (error: any) {
    return new NextResponse("Error: " + error, { status: 500 });
  }
};
