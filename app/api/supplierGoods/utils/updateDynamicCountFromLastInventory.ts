import SupplierGood from "@/app/lib/models/supplierGood";
import { Types } from "mongoose";

// update dynamicCountFromLastInventory base on inventory.currentCountQuantity
// every time the inventory is counted, the new currentCountQuantity will be the new dynamicCountFromLastInventory
export const updateDynamicCountFromLastInventory = async (
  supplierGoodId: Types.ObjectId,
  currentCountQuantity: number
) => {
  const updatedSupplierGood = await SupplierGood.findByIdAndUpdate(
    supplierGoodId,
    { dynamicCountFromLastInventory: currentCountQuantity },
    { new: true, useFindAndModify: false }
  ).lean();

  if (!updatedSupplierGood) {
    return "Supplier good not found!";
  }

  return "Supplier good dynamicCountFromLastInventory updated successfully!";
};
