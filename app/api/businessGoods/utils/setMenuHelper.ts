import { IBusinessGood } from "@/app/interface/IBusinessGood";
import BusinessGood from "@/lib/models/businessGood";
import { Types } from "mongoose";

// helper function to set setMenu
export const setMenuHelper = async (
    setMenu: Types.ObjectId[],
    allergensArray: string[] | undefined,
    obj: IBusinessGood
  ) => {
    if (Array.isArray(setMenu) && setMenu.length) {
      const businessGoods = await BusinessGood.find({
        _id: { $in: setMenu },
      })
        .select("costPrice allergens")
        .lean();
  
      obj.costPrice = businessGoods.reduce(
        (acc, businessGood) => acc + businessGood.costPrice,
        0
      );
  
      // add allergens from supplier goods to allergensArray if they are not already there
      businessGoods.forEach((businessGood) => {
        businessGood.allergens.forEach((allergen: string) => {
          if (!allergensArray?.includes(allergen)) {
            allergensArray?.push(allergen);
          }
        });
      });
  
      obj.setMenu = setMenu;
      obj.ingredients = undefined;
      return true;
    } else {
      return "Invalid setMenu array";
    }
  };