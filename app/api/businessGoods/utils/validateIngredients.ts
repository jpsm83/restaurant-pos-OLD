import { IIngredients } from "@/app/lib/interface/IBusinessGood";

export const validateIngredients = (ingredientsArray: IIngredients[]) => {
  // check if the ingredientsArray is an array
  if (!Array.isArray(ingredientsArray) || !ingredientsArray.length) {
    return "Invalid ingredients array";
  }

  const requiredFields = ["ingredient", "measurementUnit", "requiredQuantity"];

  // Iterate over ingredients to check for missing fields
  for (const ingredient of ingredientsArray) {
    const missingField = requiredFields.find(
      (field) => ingredient[field] === undefined
    );
    if (missingField) {
      return `Missing ${missingField} in ingredients array`;
    }
  }

  // All validations passed
  return true;
};
