import { IBusinessGood, IIngredients } from "@/app/lib/interface/IBusinessGood";
import { ingredientsArrayValidation } from "./ingredientsArrayValidation";
import SupplierGood from "@/app/lib/models/supplierGood";
import { calculateCostOfRequiredQuantity } from "./calculateCostOfRequiredQuantity";

// helper function to set ingredients
export const ingredientsHelper = async (
    ingredients: IIngredients[],
    allergensArray: string[] | undefined,
    obj: IBusinessGood
  ) => {
    const ingredientsArrayValidationResult =
      ingredientsArrayValidation(ingredients);
    if (ingredientsArrayValidationResult === true) {
      let ingredientsArray = [];
  
      for (let ingredient of ingredients) {
        const supplierGoodDoc = await SupplierGood.findOne({
          _id: ingredient.ingredient,
        })
          .select("measurementUnit pricePerUnit allergens")
          .lean();
  
        let ingredientObj = {
          ingredient: ingredient.ingredient,
          measurementUnit: ingredient.measurementUnit || "",
          requiredQuantity: ingredient.requiredQuantity || undefined,
          costOfRequiredQuantity: ingredient.costOfRequiredQuantity || undefined,
        };
  
        if (ingredient.measurementUnit && ingredient.requiredQuantity) {
          ingredientObj.costOfRequiredQuantity = calculateCostOfRequiredQuantity(
            ingredient,
            supplierGoodDoc
          );
        }
        ingredientsArray.push(ingredientObj);
  
        // add allergens from supplier goods to allergensArray if they are not already there
        //@ts-ignore
        (supplierGoodDoc?.allergens as string[] | undefined)?.forEach(
          (allergen) => {
            if (!allergensArray?.includes(allergen)) {
              allergensArray?.push(allergen);
            }
          }
        );
      }
  
      obj.costPrice = ingredientsArray.reduce((acc, ingredient) => {
        if (ingredient.costOfRequiredQuantity) {
          acc += ingredient.costOfRequiredQuantity;
        }
        return acc;
      }, 0);
  
      // @ts-ignore
      obj.ingredients = ingredientsArray.length ? ingredientsArray : undefined;
      obj.setMenu = undefined;
      return true;
    } else {
      return ingredientsArrayValidationResult;
    }
  };
  