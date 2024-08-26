import connectDB from "@/app/lib/db";
import { IInventory } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { handleApiError } from "@/app/lib/utils/handleApiError";
import { Types } from "mongoose";
import { NextResponse } from "next/server";

// @desc    Create new inventories
// @route   POST /inventories/:inventoryId/updateSupplierGoodInventory
// @access  Private
export const POST = async (req: Request, context: { params: { inventoryId: Types.ObjectId } }) => {
  // this function will set the count quantity of a individual supplier good in an inventory
  try {
    const { supplierGoodId, currentCountQuantity } =
      (await req.json()) as {
        supplierGoodId: Types.ObjectId;
        currentCountQuantity: number;
      };

      const inventoryId = context.params.inventoryId;

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
      .select("setFinalCount inventoryGoods comments")
      .lean();

    if (!inventory) {
      return new NextResponse(
        JSON.stringify({ message: "Inventory not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (inventory.setFinalCount === true) {
      return new NextResponse(
        JSON.stringify({
          message: "Inventory already set as final count! Cannot update!",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch supplierGoods
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("_id parLevel")
      .lean();

    if (!supplierGood) {
      return new NextResponse(
        JSON.stringify({ message: "Supplier good not found!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let updatedSupplierGoodInventoryObj = {
      supplierGood: supplierGood._id,
      currentCountQuantity: currentCountQuantity,
    };

    await Inventory.findByIdAndUpdate(
      inventoryId,
      {
        $set: {
          "inventoryGoods.$[elem]": updatedSupplierGoodInventoryObj,
        },
      },
      {
        arrayFilters: [{ "elem.supplierGood": supplierGoodId }],
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
