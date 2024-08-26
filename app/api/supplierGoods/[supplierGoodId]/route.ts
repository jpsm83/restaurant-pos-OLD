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

    // Attempt to find the supplier good and check if it's in use
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("_id business")
      .lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // ***************************************************************************
    // do not allow to delete a supplier good that is in use in any business goods
    // ***************************************************************************

    // Check if any business goods uses this supplier good
    const isInUse = await BusinessGood.exists({
      business: supplierGood.business,
      "ingredients.supplierGood": supplierGoodId,
    });

    if (isInUse) {
      return new NextResponse(
        JSON.stringify({
          message: "Supplier good is in use in some business goods!",
        }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    // delete the supplier good
    await SupplierGood.deleteOne({ _id: supplierGoodId });

    return new NextResponse(
      JSON.stringify({
        message: `Supplier good deleted successfully!`,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete supplier good failed!", error);
  }
};
