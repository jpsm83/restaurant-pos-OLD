import BusinessGood from "@/app/lib/models/businessGood";
import { Types, set } from "mongoose";

// helper function to set setMenu
export const calculateSetMenuCostPriceAndAllery = async (
  setMenu: Types.ObjectId[]
) => {
  try {
    if (Array.isArray(setMenu) && setMenu.length === 0) {
      return "Invalid setMenu array!";
    }

    // validate setMenu array of ids
    if (!setMenu.every((id) => Types.ObjectId.isValid(id))) {
      return "Invalid setMenu IDs!";
    }

    // Query all businessGoods at once
    const businessGoods = await BusinessGood.find({
      _id: { $in: setMenu },
    })
      .select("costPrice allergens")
      .lean();

    if (businessGoods.length !== setMenu.length) {
      return "Some business goods found!";
    }

    // Aggregate costPrice and allergens
    let totalCostPrice = 0;
    const allergensArr: string[] = [];

    businessGoods.forEach((good) => {
      totalCostPrice += good.costPrice;
      if (good.allergens) {
        good.allergens.forEach((allergen: string) => {
          // Add allergen to the map if it's not already present
          if (!allergensArr.includes(allergen)) {
            allergensArr.push(allergen);
          }
        });
      }
    });

    return {
      costPrice: totalCostPrice,
      allergens: allergensArr.length > 0 ? allergensArr : undefined,
    };
  } catch (error) {
    return "SetMenu array calculation and allergens failed! " + error;
  }
};
