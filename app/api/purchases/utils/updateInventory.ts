import { IPurchaseItem } from "@/app/lib/interface/IPurchase";
import Inventory from "@/app/lib/models/inventory";
import { Types } from "mongoose";

export const updateInventory = async (
  businessId: Types.ObjectId,
  purchaseItems: IPurchaseItem[]
) => {
  try {
    // Fetch the inventory document that is currently active
    const inventory = await Inventory.findOne({
      businessId: businessId,
      setFinalCount: false,
    });

    if (!inventory) {
      return "No inventory found!";
    }

    // Iterate over purchaseItems and update the corresponding dynamicSystemCount in inventoryGoods
    for (const item of purchaseItems) {
      const { supplierGoodId, quantityPurchased } = item;

      // Find the inventoryGood by supplierGoodId
      const inventoryGood = inventory.inventoryGoods.find(
        (good: any) =>
          good.supplierGoodId.toString() === supplierGoodId.toString()
      );

      if (inventoryGood) {
        // Increment the dynamicSystemCount by the quantityPurchased
        inventoryGood.dynamicSystemCount += quantityPurchased;
      } else {
        return `Supplier good ID ${supplierGoodId} not found in inventory!`;
      }
    }

    // Save the updated inventory document
    await inventory.save();

    return true;
  } catch (error) {
    return "Something went wrong on updateInventory!";
  }
};

export default updateInventory;
