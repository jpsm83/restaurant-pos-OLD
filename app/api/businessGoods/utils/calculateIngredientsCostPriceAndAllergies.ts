import { IIngredients } from "@/app/lib/interface/IBusinessGood";
import SupplierGood from "@/app/lib/models/supplierGood";
import { ISupplierGood } from "@/app/lib/interface/ISupplierGood";
import convert, { Unit } from "convert-units";

// helper function to set ingredients
export const calculateIngredientsCostPriceAndAllergies = async (
  ingredients: IIngredients[]
) => {
  try {
    let newIngredientsArray = [];

    for (let ingredient of ingredients) {
      const supplierGood: ISupplierGood | null = await SupplierGood.findOne({
        _id: ingredient.supplierGood,
      })
        .select("measurementUnit pricePerMeasurementUnit allergens")
        .lean()

      if (!supplierGood) {
        return "Supplier good not found!";
      }
      let ingredientObj = {
        supplierGood: ingredient.supplierGood,
        measurementUnit: ingredient.measurementUnit,
        requiredQuantity: ingredient.requiredQuantity,
        costOfRequiredQuantity: 0,
        allergens: supplierGood?.allergens || undefined,
      };

      if (ingredient.measurementUnit && ingredient.requiredQuantity) {
        if (supplierGood?.measurementUnit === ingredient.measurementUnit) {
          if(ingredient.measurementUnit === "unit" as string){
            ingredientObj.costOfRequiredQuantity = ingredient.requiredQuantity * (supplierGood?.pricePerMeasurementUnit ?? 0);
          } else {
          ingredientObj.costOfRequiredQuantity =
            (supplierGood.pricePerMeasurementUnit ?? 0) * ingredient.requiredQuantity;
          }
        } else {
          const convertedQuantity = convert(ingredient.requiredQuantity)
            .from(ingredient.measurementUnit)
            .to(supplierGood?.measurementUnit as Unit);
          ingredientObj.costOfRequiredQuantity =
            (supplierGood?.pricePerMeasurementUnit ?? 0) * convertedQuantity;
        }
      }
      newIngredientsArray.push(ingredientObj);
    }

    return newIngredientsArray;
  } catch (error) {
    return "Ingredients array calculation and allergens failed! " + error;
  }
};
