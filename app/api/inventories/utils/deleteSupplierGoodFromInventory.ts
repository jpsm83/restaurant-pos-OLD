import connectDB from "@/app/lib/db";
import { IInventory } from "@/app/lib/interface/IInventory";
import Inventory from "@/app/lib/models/inventory";
import { Types } from "mongoose";

export const deleteSupplierGoodFromInventory = async (
  supplierGoodId: Types.ObjectId,
  inventoryId: Types.ObjectId
) => {
  try {
    // check required fields
    if (!inventoryId || !supplierGoodId) {
      return "InventoryId and supplierGoodId are required!";
    }

    // check if the inventoryId is valid
    if (!Types.ObjectId.isValid(inventoryId)) {
      return "Invalid inventory ID";
    }

    // check if the supplierGoodId is valid
    if (!Types.ObjectId.isValid(supplierGoodId)) {
      return "Invalid supplier good ID";
    }

    // connect before first call to DB
    await connectDB();

    // check if inventory exists
    const inventory: IInventory | null = await Inventory.findById(inventoryId)
      .select("setFinalCount inventoryGoods")
      .lean();

    if (inventory?.setFinalCount === true) {
      return "Inventory already set as final count! Cannot update!";
    }

    // remove supplier good from inventory
    await Inventory.findByIdAndUpdate(inventoryId, {
      $pull: {
        inventoryGoods: { supplierGood: supplierGoodId },
      },
    });

    return "Supplier good deleted from inventory!";
  } catch (error) {
    return "Delete supplier good from inventory failed!";
  }
};
