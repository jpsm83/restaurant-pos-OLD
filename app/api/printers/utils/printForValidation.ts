import { IPrintFor } from "@/app/lib/interface/IPrinter";

// validate printFor object
export const printForValidation = (printFor: IPrintFor) => {
  // check address is an object
  if (typeof printFor !== "object" || printFor === null)
    return "Address must be an object!";

  // acceptable fields
  const validKeys = ["userId", "mainCategories", "subCategories"];

  // Check for any invalid keys
  for (const key of Object.keys(validKeys)) {
    if (!validKeys.includes(key)) {
      return `Invalid key: ${key}`;
    }
  }

  return true;
};
