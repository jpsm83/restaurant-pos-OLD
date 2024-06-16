import { IIngredients } from "@/app/interface/IBusinessGood";
import convert from "convert-units";

export const calculateCostOfRequiredQuantity = (
    businessGoodIngredient: IIngredients,
    supplierGoodDoc: any
  ) => {
    if (
      supplierGoodDoc.measurementUnit === businessGoodIngredient.measurementUnit
    ) {
      return (
        supplierGoodDoc.pricePerUnit * businessGoodIngredient.requiredQuantity
      );
    } else {
      const convertedQuantity = convert(businessGoodIngredient.requiredQuantity)
        .from(businessGoodIngredient.measurementUnit)
        .to(supplierGoodDoc.measurementUnit);
      return supplierGoodDoc.pricePerUnit * convertedQuantity;
    }
  };