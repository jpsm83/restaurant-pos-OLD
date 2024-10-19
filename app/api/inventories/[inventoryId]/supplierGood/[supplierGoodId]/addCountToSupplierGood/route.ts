import { Types } from "mongoose";
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

// this PATCH route will add on individualy supplierGood its new inventory count quantity individually
// @desc    Create new inventories
// @route   PATCH /inventories/:inventoryId/supplierGood/:supplierGoodIs/addCountToSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId; supplierGoodId: Types.ObjectId };
  }
) => {
  // this function will set the count quantity of a individual supplier good in an inventory
  const { inventoryId, supplierGoodId } = context.params;

  const { currentCountQuantity, countedByUserId, comments } =
    (await req.json()) as IInventoryCount & {
      supplierGoodId: Types.ObjectId;
    };

  // check required fields
  if (!inventoryId || !supplierGoodId || !currentCountQuantity) {
    return new NextResponse(
      JSON.stringify({
        message:
          "InventoryId, supplierGoodId and currentCountQuantity are required!",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // check if the inventoryId is valid
  if (!isObjectIdValid([inventoryId, supplierGoodId, countedByUserId])) {
    return new NextResponse(
      JSON.stringify({ message: "InventoryId or supplierGoodId not valid!" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // connect before first call to DB
    await connectDb();

    // Fetch inventory and supplier good in a single query
    const [inventory, supplierGood] = await Promise.all([
      Inventory.findOne({
        _id: inventoryId,
        "inventoryGoods.supplierGoodId": supplierGoodId, // Match specific supplierGoodId
      })
        .select("setFinalCount inventoryGoods.$") // Use $ to project only the matching element from the array
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

    // check if the inventory is already set as final count (finalized)
    if (inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the new inventory count object
    const newInventoryCount: IInventoryCount = {
      currentCountQuantity,
      quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
      countedByUserId,
      deviationPercent:
        ((inventory.inventoryGoods[0].dynamicSystemCount -
          currentCountQuantity) /
          (inventory.inventoryGoods[0].dynamicSystemCount === 0
            ? 1
            : inventory.inventoryGoods[0].dynamicSystemCount)) *
        100,
      comments,
    };

    let averageDeviationPercentCalculation = null;

    // calculate the average deviation percent
    if (currentCountQuantity !== (inventory.inventoryGoods[0].dynamicSystemCount)) {
        if (inventory.inventoryGoods[0].monthlyCounts.length > 0) {
        let sunDeviationPercent =
          inventory.inventoryGoods[0].monthlyCounts.reduce(
            (acc, count) => acc + (count.deviationPercent || 0),
            0
          ) + (newInventoryCount.deviationPercent ?? 0);
        let monthlyCountsWithDeviationPercentNotZero =
          inventory.inventoryGoods[0].monthlyCounts.filter(
            (count) =>
              count.deviationPercent !== 0 || count.deviationPercent !== null
          ).length;
        averageDeviationPercentCalculation =
          sunDeviationPercent / (monthlyCountsWithDeviationPercentNotZero + 1);
      } averageDeviationPercentCalculation = newInventoryCount.deviationPercent;
    } else {
      return new NextResponse(JSON.stringify({ message: "Inventory count didnt change from last count!" }), { headers: { "Content-Type": "application/json" }, status: 200 });
    }

    // add to the inventory, at the supplierGood its belong, inside the monthlyCounts array the new inventory count object
    await Inventory.findByIdAndUpdate(
      inventoryId,
      {
        $set: {
          "inventoryGoods.$[elem].dynamicSystemCount": currentCountQuantity,
          "inventoryGoods.$[elem].averageDeviationPercent":
            averageDeviationPercentCalculation,
        },
        $push: {
          "inventoryGoods.$[elem].monthlyCounts": newInventoryCount,
        },
      },
      {
        arrayFilters: [{ "elem.supplierGoodId": supplierGoodId }],
        new: true,
      }
    );

    return new NextResponse(JSON.stringify({ message: "Inventory count added!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Updated inventory failed!", error);
  }
};
