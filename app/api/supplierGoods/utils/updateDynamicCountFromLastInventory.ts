import connectDB from "@/app/lib/db";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";

// update dynamicCountFromLastInventory base on inventory.currentCountQuantity
// every time the inventory is counted, the new currentCountQuantity will be the new dynamicCountFromLastInventory
export const updateDynamicCountFromLastInventory = async (
  supplierGoodId: Types.ObjectId,
  updatedCountQuantity: number
) => {
  try {
    // check if supplierGoodId is valid
    if (!supplierGoodId || !Types.ObjectId.isValid(supplierGoodId)) {
      return "Invalid supplierGoodId!";
    }

    // connect before first call to DB
    await connectDB();

    // First, check if the update is necessary
    const currentGood: ISupplierGood | null = await SupplierGood.findById(
      supplierGoodId
    )
      .select("dynamicCountFromLastInventory")
      .lean();
    if (
      currentGood &&
      currentGood.dynamicCountFromLastInventory === updatedCountQuantity
    ) {
      return "No update needed, dynamicCountFromLastInventory is already up to date.";
    }

    // check if the currentGood exists
    if (!currentGood) {
      return "Supplier good not found!";
    }

    // Proceed with the update if necessary
    await SupplierGood.findByIdAndUpdate(
      supplierGoodId,
      { dynamicCountFromLastInventory: updatedCountQuantity },
      { new: true }
    );

    return "Supplier good dynamicCountFromLastInventory updated successfully!";
  } catch (error) {
    return (
      "Update dynamicCountFromLastInventory from supplier good failed! " + error
    );
  }
};
