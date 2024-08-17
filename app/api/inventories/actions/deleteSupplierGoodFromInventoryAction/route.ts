import connectDB from "@/app/lib/db";
import { IInventory } from "@/app/lib/interface/IInventory";
import Inventory from "@/app/lib/models/inventory";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Create new inventories
// @route   POST /inventories/actions
// @access  Private
export const POST = async (req: Request) => {
  try {
    const { supplierGoodId, inventoryId } = (await req.json()) as {
      supplierGoodId: Types.ObjectId;
      inventoryId: Types.ObjectId;
    };
    // check required fields
    if (!inventoryId || !supplierGoodId) {
      return new NextResponse(
        JSON.stringify({
          message: "InventoryId and supplierGoodId are required!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid inventory ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // check if the supplierGoodId is valid
    if (!Types.ObjectId.isValid(supplierGoodId)) {
      return new NextResponse(
        JSON.stringify({ message: "Invalid supplier good ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // connect before first call to DB
    await connectDB();

    // check if inventory exists
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount inventoryGoods")
      .lean();

    if (inventory?.setFinalCount === true) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // remove supplier good from inventory
    await Inventory.findByIdAndUpdate(inventoryId, {
      $pull: {
        inventoryGoods: { supplierGood: supplierGoodId },
      },
    });

    return new NextResponse(
      JSON.stringify({ message: "Supplier good deleted from inventory!" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return handleApiError("Delete supplier good from inventory failed!", error);
  }
};
