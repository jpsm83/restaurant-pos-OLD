import BusinessGood from "@/app/lib/models/businessGood";
import { Types } from "mongoose";

// helper function to set setMenu
export const calculateSetMenuCostPriceAndAllery = async (
  setMenu: Types.ObjectId[]
) => {
  try {
    if (!Array.isArray(setMenu) || !setMenu.length) {
      // validate setMenu array of ids
      if (!setMenu.every((id) => Types.ObjectId.isValid(id))) {
        return "Invalid setMenu IDs!";
      }

      const businessGoods = await BusinessGood.find({
        _id: { $in: setMenu },
      })
        .select("costPrice allergens")
        .lean();

      if (!businessGoods.length) {
        return "No business goods found!";
      }

      // create an object with costPrice and allergensArray
      const setMenuObj: { costPrice: number; allergens: string[] } = {
        costPrice: businessGoods.reduce((acc, curr) => acc + curr.costPrice, 0),
        allergens: businessGoods.reduce((acc: string[], curr) => {
          if (curr.allergens) {
            curr.allergens.forEach((allergen: string) => {
              if (!acc.includes(allergen)) {
                acc.push(allergen);
              }
            });
          }
          return acc;
        }, []),
      };

      return setMenuObj;
    } else {
      return "Invalid setMenu array!";
    }
  } catch (error) {
    return "SetMenu array calculation and allergens failed! " + error;
  }
};
