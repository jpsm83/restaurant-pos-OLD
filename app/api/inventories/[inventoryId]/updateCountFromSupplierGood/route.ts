import connectDb from "@/app/lib/utils/connectDb";
import {
  IInventory,
  IInventoryCount,
  IInventoryGood,
} from "@/app/lib/interface/IInventory";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { ISupplier } from "@/app/lib/interface/ISupplier";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// This PATCH route will update an existing count for a supplier good
// @desc    Update inventory count for a specific supplier good
// @route   PATCH /inventories/:inventoryId/updateCountFromSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId };
  }
) => {
  try {
    const { inventoryId } = context.params;

    const {
      currentCountQuantity,
      countedByUserId,
      comments,
      supplierGoodId,
      countId,
      reason,
    } = (await req.json()) as IInventoryCount & {
      supplierGoodId: Types.ObjectId;
      countId: Types.ObjectId;
      reason: string;
    };

    // Check required fields
    if (!inventoryId || !supplierGoodId || !countId) {
      return new NextResponse(
        JSON.stringify({
          message: "InventoryId, supplierGoodId, and countId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the IDs are valid
    if (!isObjectIdValid([inventoryId, supplierGoodId, countId])) {
      return new NextResponse(
        JSON.stringify({ message: "One or more IDs are not valid!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Connect to the database
    await connectDb();

    // Fetch inventory and supplier good in a single query
    const [inventory, supplierGood] = await Promise.all([
      Inventory.findById(inventoryId)
        .select("setFinalCount inventoryGoods")
        .lean() as Promise<IInventory | null>,
      SupplierGood.findById(supplierGoodId)
        .select("parLevel")
        .lean() as Promise<ISupplierGood | null>,
    ]);

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the inventory is finalized
    if (inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory is finalized! Cannot update count!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Locate the correct supplierGood and count to update
    const inventoryGood = inventory.inventoryGoods.find(
      (good) => good.supplierGoodId.toString() === supplierGoodId.toString()
    );
    if (!inventoryGood) {
      return NextResponse.json(
        { message: "Supplier good not found in inventory!" },
        { status: 404 }
      );
    }

    // Find the existing count to update
    const existingCount = inventoryGood.monthlyCounts.find(
      (count: any) => count._id.toString() === countId.toString()
    );
    if (!existingCount) {
      return NextResponse.json(
        { message: "Count not found!" },
        { status: 404 }
      );
    }

    // Prepare the reedited object
    const reeditedData = {
      reeditedByUserId: countedByUserId,
      date: new Date(),
      reason: reason, // You might want to pass this in the request as well
      originalValues: {
        currentCountQuantity: existingCount.currentCountQuantity,
        dynamicSystemCount: inventoryGood.dynamicSystemCount,
        deviationPercent: existingCount.deviationPercent,
      },
    };

    // Calculate deviationPercent and dynamicSystemCount
    const deviationPercent =
      ((inventoryGood.dynamicSystemCount - currentCountQuantity) /
        (inventoryGood.dynamicSystemCount || 1)) *
      100;

    // calculate the average deviation percent
    const averageDeviationPercent =
      inventoryGood.monthlyCounts.reduce(
        (acc, count) => acc + (count.deviationPercent || 0),
        0
      ) / inventoryGood.monthlyCounts.length;

    // Update the inventory count with optimized query
    await Inventory.findOneAndUpdate(
      {
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        "inventoryGoods.monthlyCounts._id": countId,
      },
      {
        $set: {
          "inventoryGoods.$[elem].dynamicSystemCount": currentCountQuantity,
          "inventoryGoods.$[elem].averageDeviationPercent":
            averageDeviationPercent,
          "inventoryGoods.$[elem].monthlyCounts.$[count].currentCountQuantity":
            currentCountQuantity,
          "inventoryGoods.$[elem].monthlyCounts.$[count].quantityNeeded":
            (supplierGood.parLevel || 0) - currentCountQuantity,
          "inventoryGoods.$[elem].monthlyCounts.$[count].countedByUserId":
            countedByUserId,
          "inventoryGoods.$[elem].monthlyCounts.$[count].deviationPercent":
            deviationPercent,
          "inventoryGoods.$[elem].monthlyCounts.$[count].comments": comments,
          "inventoryGoods.$[elem].monthlyCounts.$[count].reedited":
            reeditedData,
        },
      },
      {
        arrayFilters: [
          { "elem.supplierGoodId": supplierGoodId },
          { "count._id": countId },
        ],
        new: true,
      }
    );

    return new NextResponse(
      JSON.stringify({ message: "Count updated successfully!" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return handleApiError("Updating count failed!", error);
  }
};
