import { IPrintFor } from "@/app/lib/interface/IBusiness";
import isObjectIdValid from "@/app/lib/utils/isObjectIdValid";

const validateSalesLocationPrinter = (printFor: IPrintFor) => {
  // check printFor is an object
  if (typeof printFor !== "object" || printFor === null)
    return "PrintFor must be an object!";

  const validKeys = ["mainCategory", "subCategories", "printerId"];

  // Check for any invalid keys
  for (const key of Object.keys(printFor)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  // Validate each parameter
  for (const key of Object.keys(printFor)) {
    const value: any = printFor[key as keyof IPrintFor];

    if (key === "printerId") {
      let isObjectIdValidResult = isObjectIdValid([value]);

      if (isObjectIdValidResult !== true) {
        return isObjectIdValidResult;
      }
    }

    if (key === "mainCategory" && typeof value !== "string") {
      return `${key} must be a string`;
    }

    if (key === "subCategories" && value !== undefined) {
      if (
        !Array.isArray(value) ||
        !value.every((item) => typeof item === "string")
      ) {
        return `${key} must be an array of strings`;
      }
    }
  }

  return true;
};

export default validateSalesLocationPrinter;
