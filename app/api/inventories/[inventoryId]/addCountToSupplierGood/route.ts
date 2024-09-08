import connectDb from "@/app/lib/utils/connectDb";
import { IInventory, IInventoryCount } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

// this PATCH route will add on each supplierGood its new inventory count quantity individually
// @desc    Create new inventories
// @route   PATCH /inventories/:inventoryId/addCountToSupplierGood
// @access  Private
export const PATCH = async (
  req: Request,
  context: {
    params: { inventoryId: Types.ObjectId };
  }
) => {
  // this function will set the count quantity of a individual supplier good in an inventory
  try {
    const { inventoryId } = context.params;

    const { currentCountQuantity, countedByUserId, comments, supplierGoodId } =
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
    if (!isObjectIdValid([inventoryId, supplierGoodId])) {
      return new NextResponse(
        JSON.stringify({ message: "InventoryId or supplierGoodId not valid!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDb();

    // get the inventory
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount inventoryGoods")
      .lean();

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

    // get the supplier good from the supplierGoodId
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("parLevel")
      .lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Prepare the new inventory count object
    const newInventoryCount: IInventoryCount = {
      currentCountQuantity,
      countedByUserId,
      quantityNeeded: Math.max(
        supplierGood.parLevel ?? 0 - currentCountQuantity,
        0
      ),
      deviationPercent: inventory.inventoryGoods.some(
        (good) => good.toString() === supplierGoodId.toString()
      )
        ? ((supplierGood.parLevel ?? 0 - currentCountQuantity) /
            currentCountQuantity) *
          100
        : 0,
      comments,
    };

    // add to the inventory, at the supplierGood its belong, inside the monthlyCounts array the new inventory count object
    await Inventory.findByIdAndUpdate(
      inventoryId,
      {
        $push: {
          "inventoryGoods.$[elem].monthlyCounts": newInventoryCount,
        },
      },
      {
        arrayFilters: [{ "elem._id": supplierGoodId }],
        new: true,
      }
    );

    return new NextResponse(JSON.stringify({ message: "Inventory updated!" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return handleApiError("Updated inventory failed!", error);
  }
};
