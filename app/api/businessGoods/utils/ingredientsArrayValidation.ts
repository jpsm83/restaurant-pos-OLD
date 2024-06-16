import { IIngredients } from "@/app/interface/IBusinessGood";

export const ingredientsArrayValidation = (
    ingredientsArray: IIngredients[]
  ) => {
    // ingredients: [
    //    {
    //      ingredient: "6612cd163684524f0bb078da",
    //      measurementUnit: "kg",
    //      requiredQuantity: 10,
    //      costOfRequiredQuantity: 100,
    //    },
    //    {
    //      ingredient: "6612cd163684524f0bb078da",
    //      measurementUnit: "kg",
    //      requiredQuantity: 10,
    //      costOfRequiredQuantity: 100,
    //    },
    // ];
  
    // check if the ingredientsArray is an array
    if (!Array.isArray(ingredientsArray) || !ingredientsArray.length) {
      return "Invalid ingredients array";
    }
  
    const requiredFields = ["ingredient", "measurementUnit", "requiredQuantity"];
    for (const ingredient of ingredientsArray) {
      for (const field of requiredFields) {
        if (!ingredient[field]) {
          return `Missing ${field} in ingredients array`;
        }
      }
    }
  
    return true;
  };
  