import { NextResponse } from "next/server";
import connectDb from "@/app/lib/utils/connectDb";

// import models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import Supplier from "@/app/lib/models/supplier";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// @desc    Get inventories by ID
// @route   GET /inventories/:inventoryId
// @access  Private
export const GET = async (
  req: Request,
  context: { params: { inventoryId: Types.ObjectId } }
) => {
  try {
    const inventoryId = context.params.inventoryId;

    // check if the inventoryId is a valid ObjectId
    if (!isObjectIdValid([inventoryId])) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // Find inventory with the query
    const inventory = await Inventory.findById(inventoryId)
      .populate({
        path: "inventoryGoods.supplierGoodId",
        select:
          "name mainCategory subCategory supplier budgetImpact imageUrl inventorySchedule parLevel measurementUnit pricePerMeasurementUnit",
        model: SupplierGood,
        populate: {
          path: "supplier",
          select: "tradeName",
          model: Supplier,
        },
      })
      .lean();

    return !inventory
      ? new NextResponse(JSON.stringify({ message: "No inventory found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      : new NextResponse(JSON.stringify(inventory), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
  } catch (error) {
    return handleApiError("Get inventory failed!", error);
  }
};

// delete an inventory shouldnt be allowed for data integrity, historical purposes and analytics
// the only case where an inventory should be deleted is if the business itself is deleted
// @desc    Delete inventory by ID
// @route   DELETE /inventories/:inventoryId
// @access  Private
export const DELETE = async (
  req: Request,
  context: { params: { inventoryId: Types.ObjectId } }
) => {
  try {
    const inventoryId = context.params.inventoryId;

    // check if the inventoryId is a valid ObjectId
    if (!isObjectIdValid([inventoryId])) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory ID not valid!" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    // connect before first call to DB
    await connectDb();

    // delete inventory and check if it existed
    const result = await Inventory.deleteOne({
      _id: inventoryId,
    });

    if (result.deletedCount === 0) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new NextResponse(`Inventory ${inventoryId} deleted`, {
      status: 200,
    });
  } catch (error) {
    return handleApiError("Delete inventory failed!", error);
  }
};
