import connectDB from "@/app/lib/db";
import { IInventory } from "@/app/lib/interface/IInventory";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import Inventory from "@/app/lib/models/inventory";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";

export const updateIndividualSupplierGoodInventory = async (
  inventoryId: Types.ObjectId,
  supplierGoodId: Types.ObjectId,
  currentCountQuantity: number
) => {
  try {
    // check required fields
    if (!inventoryId || !supplierGoodId || currentCountQuantity) {
      return "InventoryId, supplierGoodId and currentCountQuantity are required!";
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
      .select("setFinalCount inventoryGoods comments")
      .lean();

    if (!inventory) {
      return "Inventory not found!";
    }

    if (inventory.setFinalCount === true) {
      return "Inventory already set as final count! Cannot update!";
    }

    // Fetch supplierGoods
    const supplierGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("_id dynamicCountFromLastInventory parLevel")
      .lean();

    if (!supplierGood) {
      return "Supplier good not found!";
    }

    let updatedSupplierGoodInventoryObj = {
      supplierGood: supplierGood._id,
      systemCountQuantity: supplierGood.dynamicCountFromLastInventory,
      currentCountQuantity: currentCountQuantity,
      deviationPercent:
        (((supplierGood.dynamicCountFromLastInventory ?? 0) -
          currentCountQuantity) /
          (supplierGood.parLevel || 1)) *
        100,
      quantityNeeded: (supplierGood.parLevel || 0) - currentCountQuantity,
      lastInventoryCountDate: new Date(),
    };

    SupplierGood.findByIdAndUpdate(supplierGood._id, {
      dynamicCountFromLastInventory: currentCountQuantity,
      lastInventoryCountDate: new Date(),
    });

    await Inventory.findByIdAndUpdate(
      {
        _id: inventoryId,
        "inventoryGoods.supplierGood":
          updatedSupplierGoodInventoryObj.supplierGood,
      },
      {
        $set: { "inventoryGoods.$": updatedSupplierGoodInventoryObj },
      },
      {
        new: true,
        useFindAndModify: false,
      }
    );

    return "Inventory updated!";
  } catch (error) {
    return "Updated inventory failed!";
  }
};
