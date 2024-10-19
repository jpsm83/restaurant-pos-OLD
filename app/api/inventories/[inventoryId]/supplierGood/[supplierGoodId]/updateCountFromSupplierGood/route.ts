import mongoose, { Types } from "mongoose";
import { NextResponse } from "next/server";

// imported utils
import connectDb from "@/app/lib/utils/connectDb";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// imported interfaces
import { IInventory, IInventoryCount } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";

// imported models
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";

// This PATCH route will update ONLY THE LAST existing count for an individualy supplier good from the inventory
// @desc    Update inventory count for a specific supplier good
// @route   PATCH /inventories/:inventoryId/supplierGood/:supplierGoodIs/updateCountFromSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  const { inventoryId, supplierGoodId } = context.params;

  const { currentCountQuantity, countedByUserId, comments, countId, reason } =
    (await req.json()) as IInventoryCount & {
      supplierGoodId: Types.ObjectId;
      countId: Types.ObjectId;
      reason: string;
    };

  // Check required fields
  if (!inventoryId || !supplierGoodId || !countId || !reason) {
    return new NextResponse(
      JSON.stringify({
        message:
          "InventoryId, supplierGoodId, countId and reason are required!",
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

  try {
    // Connect to the database
    await connectDb();

    // Fetch inventory and supplier good in a single query
    const [inventory, supplierGood] = await Promise.all([
      Inventory.findOne({
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId, // Match specific supplierGoodId
      })
        .select("setFinalCount inventoryGoods") // Use $ to project only the matching element from the array
        .lean() as Promise<IInventory | null>,
      SupplierGood.findById(supplierGoodId)
        .select("parLevel")
        .lean() as Promise<ISupplierGood | null>,
    ]);

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the inventory is finalized
    if (inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // get the supplier good object
    const supplierGoodObject: any = inventory.inventoryGoods.find(
      (good) => good.supplierGoodId.toString() === supplierGoodId.toString()
    );

    // get the current count object
    const currentCountObject = supplierGoodObject.monthlyCounts.find(
      (count: any) => count._id.toString() === countId.toString()
    );

    let previewDynamicSystemCount = null;

    // calculate the preview dynamic system count
    previewDynamicSystemCount =
      currentCountObject.currentCountQuantity /
      (1 - (currentCountObject.deviationPercent ?? 0) / 100);

    // Prepare the new inventory count object
    const updateInventoryCount: IInventoryCount = {
      currentCountQuantity,
      quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
      countedByUserId,
      deviationPercent:
        ((previewDynamicSystemCount ?? 0 - currentCountQuantity) /
          (previewDynamicSystemCount || 1)) *
        100,
      comments,
    };

    // Prepare the reedited object
    updateInventoryCount.reedited = {
      reeditedByUserId: countedByUserId,
      date: new Date(),
      reason, // You might want to pass this in the request as well
      originalValues: {
        currentCountQuantity: currentCountObject.currentCountQuantity,
        deviationPercent: currentCountObject.deviationPercent ?? null,
        dynamicSystemCount: previewDynamicSystemCount,
      },
    };

    // calculate the average deviation percent
    let averageDeviationPercentCalculation = null;

    if (
      currentCountQuantity !== (currentCountObject.currentCountQuantity ?? 0)
    ) {
      let sunDeviationPercent =
        supplierGoodObject.monthlyCounts.reduce(
          (acc: number, count: { deviationPercent: number }) =>
            acc + (count.deviationPercent || 0),
          0
        ) -
        (currentCountObject.deviationPercent ?? 0) +
        (updateInventoryCount.deviationPercent ?? 0);
      let monthlyCountsWithDeviationPercentNotZero =
        supplierGoodObject.monthlyCounts.filter(
          (count: { deviationPercent: number }) =>
            count.deviationPercent !== 0 || count.deviationPercent !== null
        ).length;
      averageDeviationPercentCalculation =
        sunDeviationPercent / monthlyCountsWithDeviationPercentNotZero;
    }

    // Update the inventory count with optimized query
    await Inventory.findOneAndUpdate(
      {
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId,
        "inventoryGoods.monthlyCounts._id": countId, // Ensure this matches the correct count
      },
      {
        $set: {
          "inventoryGoods.$[elem1].dynamicSystemCount": currentCountQuantity,
          "inventoryGoods.$[elem1].averageDeviationPercent":
            averageDeviationPercentCalculation,
          "inventoryGoods.$[elem1].monthlyCounts.$[elem2]":
            updateInventoryCount, // Correctly reference monthlyCounts
        },
      },
      {
        arrayFilters: [
          { "elem1.supplierGoodId": supplierGoodId }, // Matches supplierGood in inventoryGoods
          { "elem2._id": countId }, // Matches count in monthlyCounts by _id
        ],
        new: true, // Return the updated document
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
