// imported interfaces
import { IPurchaseItem } from "@/app/lib/interface/IPurchase";

// imported utils
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

export const validatePurchaseItems = (purchaseItems: IPurchaseItem[]) => {
  // example of a purchase item object
  // purchaseItems = [
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 5,
  //     purchasePrice: 100,
  //   },
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 10,
  //     purchasePrice: 200,
  //   },
  //   {
  //     supplierGood: "5f5e5e5e5e5e5e5e5e5e5e5e",
  //     quantityPurchased: 15,
  //     purchasePrice: 300,
  //   },
  // ];

  for (const purchaseItem of purchaseItems) {
   // validate supplierGood
   if (!isObjectIdValid([purchaseItem.supplierGoodId])) {
    return "Incorrect supplier good Id!";
  }
  if (
    !purchaseItem.quantityPurchased ||
    purchaseItem.quantityPurchased === 0
  ) {
    return "Incorrect quantity purchased!";
  }
  if (!purchaseItem.purchasePrice || purchaseItem.purchasePrice === 0) {
    return "Incorrect purchase price!";
  }
}
  return true;
};
