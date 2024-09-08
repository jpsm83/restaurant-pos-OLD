import connectDb from "@/app/lib/utils/connectDb";
import { IInventory, IInventoryCount } from "@/app/lib/interface/IInventory";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";
import { ISupplier } from "@/app/lib/interface/ISupplier";

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

    // Fetch the inventory
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount inventoryGoods")
      .lean();

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
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

    // Fetch the supplier good
    const supplierGood: any = await SupplierGood.findById(supplierGoodId)
      .select("parLevel")
      .lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Find the existing count to update
    const existingCount = inventory.inventoryGoods
      .find(
        (good) => good.supplierGoodId.toString() === supplierGoodId.toString()
      )
      ?.monthlyCounts.find(
        (count: any) => count._id.toString() === countId.toString()
      );

    if (!existingCount) {
      return new NextResponse(JSON.stringify({ message: "Count not found!" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Calculate dynamicSystemCount based on currentCountQuantity and deviationPercent
    const previewsDynamicSystemCount =
      existingCount.currentCountQuantity *
      (1 + (existingCount.deviationPercent ?? 0 / 100));

    // Prepare the reedited object
    const reeditedData = {
      reeditedByUserId: countedByUserId,
      date: new Date(),
      reason: reason, // You might want to pass this in the request as well
      originalValues: {
        currentCountQuantity: existingCount.currentCountQuantity,
        dynamicSystemCount: previewsDynamicSystemCount,
        deviationPercent: existingCount.deviationPercent ?? 0,
      },
    };

    // Update the inventory count
    await Inventory.findOneAndUpdate(
      {
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        "inventoryGoods.monthlyCounts._id": countId,
      },
      {
        $set: {
          "inventoryGoods.$[elem].monthlyCounts.$[count].currentCountQuantity":
            currentCountQuantity,
          "inventoryGoods.$[elem].monthlyCounts.$[count].countedByUserId":
            countedByUserId,
          "inventoryGoods.$[elem].monthlyCounts.$[count].comments": comments,
          "inventoryGoods.$[elem].monthlyCounts.$[count].quantityNeeded":
            Math.max(
              (supplierGood.parLevel ?? 0) - (currentCountQuantity ?? 0),
              0
            ),
          "inventoryGoods.$[elem].monthlyCounts.$[count].deviationPercent":
            currentCountQuantity !== undefined
              ? ((supplierGood.parLevel ?? 0 - (currentCountQuantity ?? 0)) /
                  (currentCountQuantity ?? 1)) *
                100
              : 0,
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
