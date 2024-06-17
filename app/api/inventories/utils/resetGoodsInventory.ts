import Inventory from "@/lib/models/inventory";
import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { updateDynamicCountFromLastInventory } from "../../supplierGoods/utils/updateDynamicCountFromLastInventory";
import { IInventoryGood } from "@/app/interface/IInventory";
import connectDB from "@/lib/db";

export const resetGoodsInventory = async (
  inventoryId: Types.ObjectId,
  inventoryGoodsIdToReset: IInventoryGood[]
) => {
  // UPDATE reset inventory, if mistakes were made and inventory is set as setFinalCount, you can reset the inventory selecting the supplierGoods you want to reset. The supplierGood.dynamicCountFromLastInventory and systemCountQuantity will be updated to the currentCountQuantity (only in extreme cases)
  try {
    // connect before first call to DB
    await connectDB();

    // check inventory exists
    const inventory = (await Inventory.findById(inventoryId)
      .select("setFinalCount")
      .lean()) as { setFinalCount: boolean };
    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 404 }
      );
    }

    // check if inventoryGoodsIdToReset goods is an array of objects
    if (
      !Array.isArray(inventoryGoodsIdToReset) ||
      inventoryGoodsIdToReset.length === 0
    ) {
      return new NextResponse(
        JSON.stringify({
          message:
            "Inventory goods to reset must be an array of supplier goods IDs and current count!",
        }),
        { status: 400 }
      );
    } else if (
      inventoryGoodsIdToReset.some(
        (good) => !good.supplierGood || !good.currentCountQuantity
      )
    ) {
      new NextResponse(
        JSON.stringify({
          message:
            "Inventory goods to reset must have supplierGood and currentCountQuantity!",
        }),
        { status: 400 }
      );
    }

    // check if inventory is set as final count
    if (!inventory.setFinalCount) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory is not set as final count yet! Cannot reset!",
        }),
        { status: 400 }
      );
    }

    await Promise.all(
      inventoryGoodsIdToReset.map((good) => {
        if (good.currentCountQuantity !== undefined) {
          return updateDynamicCountFromLastInventory(
            good.supplierGood,
            good.currentCountQuantity
          );
        }
      })
    );

    return NextResponse.json(
      { message: "Inventory reset successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "An error occurred while resetting inventory." },
      { status: 500 }
    );
  }
};
